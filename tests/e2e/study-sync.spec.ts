import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { test, expect, type BrowserContext, type Page } from "@playwright/test"

// Browser fixtures must never write to the developer's or hosted database.
const databaseUrl = process.env.DATABASE_URL ?? ""
if (process.env.STUDYSYNC_TEST_DATABASE !== "1" || !databaseUrl.startsWith("file:") || !databaseUrl.includes("studysync-e2e-") || !/[\\/]test\.db$/.test(databaseUrl)) {
  throw new Error("Run these browser tests with npm run test:e2e and its isolated temporary database.")
}

const prisma = new PrismaClient()
const createdUsers: string[] = []
const baseUrl = "http://localhost:3100"

async function account(name: string) {
  const user = await prisma.user.create({ data: { name, email: `${randomUUID()}@example.test` } })
  createdUsers.push(user.id)
  return user
}

async function signIn(context: BrowserContext, userId: string) {
  const sessionToken = randomUUID()
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  await prisma.session.create({ data: { sessionToken, userId, expires } })
  await context.addCookies([{ name: "authjs.session-token", value: sessionToken, url: baseUrl, httpOnly: true, sameSite: "Lax", expires: Math.floor(expires.getTime() / 1000) }])
}

function dateAfter(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

test.afterEach(async () => {
  if (createdUsers.length) await prisma.user.deleteMany({ where: { id: { in: createdUsers.splice(0) } } })
})

test.afterAll(async () => { await prisma.$disconnect() })

test("anonymous visitors sign in and both OAuth providers expose the expected callback routes", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Continue with Microsoft", exact: true })).toBeEnabled()
  const response = await page.request.get("/api/auth/providers")
  expect(response.ok()).toBe(true)
  const providers = await response.json()
  expect(providers.google.callbackUrl).toBe(`${baseUrl}/api/auth/callback/google`)
  expect(providers["microsoft-entra-id"].callbackUrl).toBe(`${baseUrl}/api/auth/callback/microsoft-entra-id`)
  await page.goto(`/join/${"a1".repeat(32)}`)
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fjoin%2F/)
  await page.setViewportSize({ width: 390, height: 844 })
  await noHorizontalOverflow(page)
})

test("personal tasks can be created, edited, persisted, completed, reopened, and deleted", async ({ page, context }) => {
  const user = await account("Personal Student")
  await signIn(context, user.id)
  await page.goto("/")
  await page.getByRole("button", { name: "+ New task", exact: true }).click()
  await page.getByLabel("Task title", { exact: true }).fill("Draft literature review")
  await page.getByLabel(/^Module/).fill("SP126")
  await page.getByLabel(/^Due date/).fill(dateAfter(4))
  await page.getByRole("button", { name: "Save task", exact: true }).click()
  const tasks = page.getByRole("region", { name: "Personal tasks & deadlines" })
  const originalTitle = tasks.getByRole("paragraph").filter({ hasText: /^Draft literature review$/ })
  const editedTitle = tasks.getByRole("paragraph").filter({ hasText: /^Revise literature review$/ })
  await expect(originalTitle).toBeVisible()
  await page.reload()
  await expect(originalTitle).toBeVisible()
  await tasks.getByRole("button", { name: "Edit Draft literature review", exact: true }).click()
  await page.getByLabel("Task title", { exact: true }).fill("Revise literature review")
  await page.getByRole("button", { name: "Save task", exact: true }).click()
  await expect(editedTitle).toBeVisible()

  await page.screenshot({ path: test.info().outputPath("dashboard-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await noHorizontalOverflow(page)
  await page.screenshot({ path: test.info().outputPath("dashboard-mobile.png"), fullPage: true })

  await tasks.getByRole("checkbox", { name: "Mark Revise literature review as completed" }).check()
  await expect(editedTitle).toBeHidden()
  await tasks.getByRole("button", { name: /^Completed / }).click()
  await expect(editedTitle).toBeVisible()
  await tasks.getByRole("checkbox", { name: "Mark Revise literature review as pending" }).uncheck()
  await tasks.getByRole("button", { name: /^Pending / }).click()
  await tasks.getByRole("button", { name: "Delete Revise literature review", exact: true }).click()
  await tasks.getByRole("button", { name: "Delete task", exact: true }).click()
  await expect(editedTitle).toBeHidden()
  await expect.poll(() => prisma.task.count({ where: { userId: user.id } })).toBe(0)
})

test("focus sessions resume after reload and record completed time only once", async ({ page, context }) => {
  const user = await account("Focused Student")
  await signIn(context, user.id)
  await page.goto("/")
  const timer = page.getByRole("region", { name: "Focus timer" })
  await timer.getByRole("button", { name: "Start session", exact: true }).click()
  await expect(timer.getByText("Focus time is running", { exact: true })).toBeVisible()
  const started = await prisma.studySession.findUniqueOrThrow({ where: { activeUserId: user.id } })
  await page.reload()
  await expect(timer.getByText("Focus time is running", { exact: true })).toBeVisible()
  expect(await prisma.studySession.count({ where: { userId: user.id } })).toBe(1)

  // Move only this synthetic fixture's clock; production code still checks server elapsed time.
  await prisma.studySession.update({ where: { id: started.id }, data: { startedAt: new Date(Date.now() - 1_501_000) } })
  await page.reload()
  await timer.getByRole("button", { name: "Save completed session", exact: true }).click()
  await expect(timer.getByRole("button", { name: "Start session", exact: true })).toBeVisible()
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Study time this week", exact: true }) }).getByText("25m", { exact: true })).toBeVisible()
  await page.reload()
  expect(await prisma.studySession.count({ where: { userId: user.id, completedAt: { not: null } } })).toBe(1)
  await expect(timer.getByRole("button", { name: "Start session", exact: true })).toBeVisible()
})

test("a project invitation leads to assigned work, feedback, an approved extension, and completion", async ({ page, context, browser }) => {
  test.setTimeout(120_000)
  const owner = await account("Project Admin")
  const member = await account("Team Student")
  const initialDeadline = dateAfter(1)
  const extendedDeadline = dateAfter(3)
  await signIn(context, owner.id)
  await page.goto("/projects")
  await page.getByLabel("Project name", { exact: true }).fill("Research Team")
  await page.getByLabel(/^Description/).fill("Plan, discuss, and complete the research project together.")
  await page.getByRole("button", { name: "Create project", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Research Team", exact: true })).toBeVisible()
  const projectUrl = page.url()
  const projectId = new URL(projectUrl).pathname.split("/").at(-1)!
  await page.getByRole("button", { name: "Create invitation link", exact: true }).click()
  const invite = page.getByLabel("Invitation link", { exact: true })
  await expect(invite).toBeVisible()
  const invitationUrl = await invite.inputValue()
  expect(invitationUrl).toMatch(/^http:\/\/localhost:3100\/join\/[a-f0-9]{64}$/)

  const memberContext = await browser.newContext({ baseURL: baseUrl })
  try {
    await signIn(memberContext, member.id)
    const memberPage = await memberContext.newPage()
    await memberPage.goto(invitationUrl)
    await expect(memberPage.getByRole("heading", { level: 1, name: "Join Research Team" })).toBeVisible()
    expect(await prisma.projectMember.count({ where: { projectId, userId: member.id } })).toBe(0)
    await memberPage.getByRole("button", { name: "Join project", exact: true }).click()
    await expect(memberPage.getByRole("heading", { level: 1, name: "Research Team", exact: true })).toBeVisible()
    await expect(memberPage.getByRole("button", { name: "+ Assign task", exact: true })).toHaveCount(0)

    await page.getByRole("button", { name: "Refresh project", exact: true }).click()
    await expect(page.getByText("Team Student", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "+ Assign task", exact: true }).click()
    await page.getByLabel("Task title", { exact: true }).fill("Review research sources")
    await page.getByLabel("Assign to", { exact: true }).selectOption(member.id)
    await page.getByLabel("Priority", { exact: true }).selectOption("HIGH")
    await page.getByLabel(/^Due date/).fill(initialDeadline)
    await page.getByRole("button", { name: "Create task", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Review research sources", exact: true })).toBeVisible()
    const task = await prisma.projectTask.findFirstOrThrow({ where: { projectId, title: "Review research sources" } })

    await memberPage.goto("/")
    await expect(memberPage.getByRole("region", { name: /^Assigned to you/ }).getByText("Review research sources", { exact: true })).toBeVisible()
    await memberPage.getByRole("link").filter({ hasText: "Review research sources" }).click()
    const taskCard = memberPage.locator(`#project-task-${task.id}`)
    await expect(taskCard).toBeVisible()
    await expect(memberPage.getByRole("region", { name: "Your reminders" }).getByText("Review research sources", { exact: true })).toBeVisible()
    await taskCard.getByRole("button", { name: "Request more time", exact: true }).click()
    await taskCard.getByLabel("Requested date", { exact: true }).fill(extendedDeadline)
    await taskCard.getByLabel("Reason", { exact: true }).fill("I need to verify two additional sources.")
    await taskCard.getByRole("button", { name: "Send request", exact: true }).click()
    await expect(taskCard.getByText("I need to verify two additional sources.", { exact: true })).toBeVisible()
    expect((await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate).toBe(initialDeadline)

    await page.getByRole("button", { name: "Refresh project", exact: true }).click()
    await page.getByRole("button", { name: "Approve extension", exact: true }).click()
    await expect.poll(async () => (await prisma.projectTask.findUniqueOrThrow({ where: { id: task.id } })).dueDate).toBe(extendedDeadline)

    await memberPage.getByRole("button", { name: "Refresh project", exact: true }).click()
    await taskCard.getByRole("button", { name: /^Feedback \(/ }).click()
    await taskCard.getByLabel("Feedback message", { exact: true }).fill("The sources are now checked and ready for review.")
    await taskCard.getByRole("button", { name: "Post feedback", exact: true }).click()
    await expect(taskCard.getByText("The sources are now checked and ready for review.", { exact: true })).toBeVisible()
    await memberPage.getByLabel("Project message", { exact: true }).fill("I have finished the source review.")
    await memberPage.getByRole("button", { name: "Post message", exact: true }).click()
    await expect(memberPage.getByRole("list", { name: "Project messages" }).getByText("I have finished the source review.", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Refresh project", exact: true }).click()
    await expect(page.getByText("I have finished the source review.", { exact: true })).toBeVisible()
    await page.screenshot({ path: test.info().outputPath("project-desktop.png"), fullPage: true })
    await memberPage.setViewportSize({ width: 390, height: 844 })
    await noHorizontalOverflow(memberPage)
    await memberPage.screenshot({ path: test.info().outputPath("project-mobile.png"), fullPage: true })

    await taskCard.getByRole("checkbox", { name: "Mark Review research sources as completed" }).check()
    await expect(taskCard).toBeHidden()
    await memberPage.goto("/")
    await expect(memberPage.getByRole("region", { name: /^Assigned to you/ }).getByText("Review research sources", { exact: true })).toHaveCount(0)
  } finally {
    await memberContext.close()
  }
})

test("private projects are unavailable to nonmembers and expired sessions redirect to login", async ({ page, context }) => {
  const owner = await account("Private Owner")
  const outsider = await account("Outside Student")
  const project = await prisma.project.create({ data: { name: "Private project", ownerId: owner.id, members: { create: { userId: owner.id } } } })
  await signIn(context, outsider.id)
  await page.goto(`/projects/${project.id}`)
  await expect(page.getByRole("heading", { name: "This page could not be found.", exact: true })).toBeVisible()
  await expect(page.getByText("Private project", { exact: true })).toHaveCount(0)
  await prisma.session.updateMany({ where: { userId: outsider.id }, data: { expires: new Date(Date.now() - 1000) } })
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)
})
