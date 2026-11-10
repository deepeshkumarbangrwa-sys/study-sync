import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { prisma } from "../src/lib/prisma"
import {
  abandonStudySessionForUser,
  completeStudySessionForUser,
  createTaskForUser,
  deleteTaskForUser,
  getDashboard,
  setTaskCompletedForUser,
  startStudySessionForUser,
  updateTaskForUser,
} from "../src/lib/planner"
import { FOCUS_DURATION_SECONDS, PlannerError, parseTaskInput, utcWeekBounds } from "../src/lib/planner-validation"

before(() => {
  // Tests must never run against a developer's normal database.
  assert.equal(process.env.STUDYSYNC_TEST_DATABASE, "1", "Run tests with npm test.")
  const database = fileURLToPath(process.env.DATABASE_URL ?? "")
  assert.ok(resolve(database).startsWith(`${resolve(tmpdir())}${sep}studysync-test-`))
  assert.ok(database.endsWith(`${sep}test.db`))
})

after(async () => {
  await prisma.$disconnect()
})

async function user() {
  return prisma.user.create({ data: { email: `${randomUUID()}@example.test`, name: "Test Student" } })
}

test("task validation trims editable fields and rejects invalid dates and lengths", () => {
  assert.deepEqual(parseTaskInput({ title: "  Read chapter 2  ", module: "  Maths  ", dueDate: "2028-02-29", userId: "attacker", completed: true }), {
    title: "Read chapter 2", module: "Maths", dueDate: "2028-02-29",
  })
  assert.deepEqual(parseTaskInput({ title: "Read", module: " ", dueDate: "" }), {
    title: "Read", module: null, dueDate: null,
  })
  for (const input of [
    null,
    { title: " " },
    { title: "x".repeat(201) },
    { title: "Read", module: "x".repeat(81) },
    { title: "Read", module: 20 },
    { title: "Read", dueDate: "2027-02-29" },
    { title: "Read", dueDate: "2026-04-31" },
    { title: "Read", dueDate: "09/11/2026" },
    { title: "Read", dueDate: 20261109 },
  ]) assert.throws(() => parseTaskInput(input), PlannerError)
})

test("a user's task changes persist and client ownership fields are ignored", async () => {
  const owner = await user()
  const other = await user()
  const task = await createTaskForUser(owner.id, { title: " First draft ", module: "SP126", dueDate: "2026-12-05", userId: other.id, completed: true })
  assert.equal(task.title, "First draft")
  assert.equal(task.completed, false)
  assert.equal((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).userId, owner.id)
  assert.equal("userId" in task, false)

  const edited = await updateTaskForUser(owner.id, task.id, { title: "Final draft", dueDate: "2026-12-06" })
  assert.equal(edited.title, "Final draft")
  assert.equal(edited.dueDate, "2026-12-06")
  assert.equal(edited.module, null)
  assert.equal((await setTaskCompletedForUser(owner.id, task.id, true)).completed, true)
  assert.equal((await setTaskCompletedForUser(owner.id, task.id, false)).completed, false)
  await deleteTaskForUser(owner.id, task.id)
  assert.equal(await prisma.task.findUnique({ where: { id: task.id } }), null)
})

test("another user cannot read, update, complete, or delete a task", async () => {
  const owner = await user()
  const other = await user()
  const task = await createTaskForUser(owner.id, { title: "Private coursework" })
  assert.equal((await getDashboard(other.id)).tasks.length, 0)
  await assert.rejects(updateTaskForUser(other.id, task.id, { title: "Changed" }), PlannerError)
  await assert.rejects(setTaskCompletedForUser(other.id, task.id, true), PlannerError)
  await assert.rejects(deleteTaskForUser(other.id, task.id), PlannerError)
  const saved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
  assert.equal(saved.title, "Private coursework")
  assert.equal(saved.completed, false)
})

test("invalid task mutations cannot write malformed status or date values", async () => {
  const owner = await user()
  const task = await createTaskForUser(owner.id, { title: "Essay" })
  await assert.rejects(setTaskCompletedForUser(owner.id, task.id, "true"), PlannerError)
  await assert.rejects(updateTaskForUser(owner.id, task.id, { title: "Essay", dueDate: "2026-13-01" }), PlannerError)
  await assert.rejects(deleteTaskForUser(owner.id, ""), PlannerError)
  assert.equal((await getDashboard(owner.id)).pendingTasks, 1)
})

test("concurrent timer starts resume a single persistent session", async () => {
  const owner = await user()
  const sessions = await Promise.all([
    startStudySessionForUser(owner.id),
    startStudySessionForUser(owner.id),
    startStudySessionForUser(owner.id),
  ])
  assert.equal(new Set(sessions.map((session) => session.id)).size, 1)
  assert.equal(sessions[0].durationSeconds, FOCUS_DURATION_SECONDS)
  assert.equal((await getDashboard(owner.id)).activeSession?.id, sessions[0].id)
  assert.equal(await prisma.studySession.count({ where: { userId: owner.id } }), 1)
})

test("timer completion uses elapsed server time and records a finished block once", async () => {
  const owner = await user()
  const session = await startStudySessionForUser(owner.id)
  await assert.rejects(completeStudySessionForUser(owner.id, session.id), /still running/)
  assert.equal((await getDashboard(owner.id)).studyMinutesThisWeek, 0)

  // Only the test changes database time; browser callers cannot supply it.
  await prisma.studySession.update({
    where: { id: session.id },
    data: { startedAt: new Date(Date.now() - (FOCUS_DURATION_SECONDS + 2) * 1000) },
  })
  const completions = await Promise.all([
    completeStudySessionForUser(owner.id, session.id),
    completeStudySessionForUser(owner.id, session.id),
  ])
  assert.equal(completions.filter((result) => !result.alreadyCompleted).length, 1)
  assert.deepEqual(await completeStudySessionForUser(owner.id, session.id), { alreadyCompleted: true })
  const dashboard = await getDashboard(owner.id)
  assert.equal(dashboard.activeSession, null)
  assert.equal(dashboard.studyMinutesThisWeek, 25)
  assert.notEqual((await startStudySessionForUser(owner.id)).id, session.id)
})

test("another user cannot complete or reset a focus session", async () => {
  const owner = await user()
  const other = await user()
  const session = await startStudySessionForUser(owner.id)
  assert.equal((await getDashboard(other.id)).activeSession, null)
  await assert.rejects(completeStudySessionForUser(other.id, session.id), PlannerError)
  await assert.rejects(abandonStudySessionForUser(other.id, session.id), PlannerError)
  assert.equal((await getDashboard(owner.id)).activeSession?.id, session.id)
})

test("reset sessions cannot be saved or inflate study totals", async () => {
  const owner = await user()
  const session = await startStudySessionForUser(owner.id)
  await abandonStudySessionForUser(owner.id, session.id)
  await abandonStudySessionForUser(owner.id, session.id)
  await assert.rejects(completeStudySessionForUser(owner.id, session.id), /reset/)
  const dashboard = await getDashboard(owner.id)
  assert.equal(dashboard.activeSession, null)
  assert.equal(dashboard.studyMinutesThisWeek, 0)
  assert.notEqual((await startStudySessionForUser(owner.id)).id, session.id)
})

test("UTC week boundaries start Monday and handle year rollover", () => {
  const sunday = utcWeekBounds(new Date("2027-01-03T23:59:59.999Z"))
  assert.equal(sunday.start.toISOString(), "2026-12-28T00:00:00.000Z")
  assert.equal(sunday.end.toISOString(), "2027-01-04T00:00:00.000Z")
  const monday = utcWeekBounds(new Date("2027-01-04T00:00:00.000Z"))
  assert.equal(monday.start.toISOString(), "2027-01-04T00:00:00.000Z")
})

test("dashboard aggregates only the owner's current-week completed blocks and active modules", async () => {
  const owner = await user()
  const other = await user()
  const { start, end } = utcWeekBounds(new Date())
  await createTaskForUser(owner.id, { title: "Task A", module: "Maths" })
  await createTaskForUser(owner.id, { title: "Task B", module: "maths" })
  const completed = await createTaskForUser(owner.id, { title: "Task C", module: "History" })
  await setTaskCompletedForUser(owner.id, completed.id, true)
  await createTaskForUser(other.id, { title: "Other user's task", module: "Science" })

  for (const data of [
    { userId: owner.id, completedAt: start },
    { userId: owner.id, completedAt: new Date(start.getTime() - 1) },
    { userId: owner.id, completedAt: end },
    { userId: other.id, completedAt: start },
    { userId: owner.id, abandonedAt: start },
  ]) {
    await prisma.studySession.create({
      data: { ...data, startedAt: new Date(start.getTime() - FOCUS_DURATION_SECONDS * 1000), durationSeconds: FOCUS_DURATION_SECONDS },
    })
  }
  const dashboard = await getDashboard(owner.id)
  assert.equal(dashboard.tasks.length, 3)
  assert.equal(dashboard.pendingTasks, 2)
  assert.equal(dashboard.activeModules, 1)
  assert.equal(dashboard.studyMinutesThisWeek, 25)
})
