from pathlib import Path
from textwrap import wrap
import sys

sys.path.insert(0, "/workspace/work/poster-tools")

import qrcode
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt
from reportlab.lib.colors import HexColor as _HexColor
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas


HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
PPTX_OUT = HERE / "PadhSang_ARU_Poster_A3_Final.pptx"
PDF_OUT = HERE / "PadhSang_ARU_Poster_A3_Final.pdf"
QR_PATH = ASSETS / "github-qr.png"

W, H = 16.5354, 11.6929
NAVY = "17365D"
TEAL = "00838D"
AMBER = "F4B43A"
INK = "253140"
MUTED = "5B6978"
LINE = "C6D4DA"
PALE = "EEF4F6"
PALE_BLUE = "EAF1F6"
WHITE = "FFFFFF"
GREEN = "087F5B"

SUMMARY = (
    "I built and tested PadhSang to investigate how OAuth and server-side "
    "access control protect student collaboration, passing all 25 automated checks."
)
RESEARCH_QUESTION = (
    "How can OAuth and server-side access control protect a practical "
    "student collaboration workspace?"
)
GITHUB_URL = "https://github.com/deepeshkumarbangrwa-sys/study-sync"


def rgb(value):
    return RGBColor.from_string(value)


def hc(value):
    return _HexColor(value if value.startswith("#") else f"#{value}")


def add_rect(slide, x, y, w, h, fill=WHITE, line=None, radius=False):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    if line:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(0.8)
    else:
        shape.line.fill.background()
    return shape


def add_text(slide, text, x, y, w, h, size=13, color=INK, bold=False,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margins=0,
             fit=True, font="Aptos"):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margins)
    tf.margin_top = tf.margin_bottom = Inches(margins)
    tf.vertical_anchor = valign
    if fit:
        tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    p.font.name = font
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.color.rgb = rgb(color)
    p.space_before = p.space_after = Pt(0)
    p.line_spacing = 1.0
    return box


def add_body(slide, lines, x, y, w, h, size=12.5, color=INK):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = tf.margin_right = Inches(0)
    tf.margin_top = tf.margin_bottom = Inches(0)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        is_bullet = line.startswith("•")
        p.text = line
        p.font.name = "Aptos"
        p.font.size = Pt(size)
        p.font.color.rgb = rgb(color)
        p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(0)
        p.space_after = Pt(5)
        p.line_spacing = 1.05
        if is_bullet:
            p.text = "•  " + line[1:].strip()
    return box


def add_section_heading(slide, number, title, x, y, w):
    add_text(slide, f"{number}  {title}", x, y, w, 0.33,
             size=18, color=NAVY, bold=True)
    add_rect(slide, x, y + 0.37, w, 0.012, fill=LINE)
    add_rect(slide, x, y + 0.37, 0.55, 0.055, fill=TEAL)


def add_metric(slide, value, label, x, y, w):
    add_text(slide, value, x, y, w, 0.5, size=30, color=NAVY, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, label.upper(), x, y + 0.51, w, 0.27, size=9.5,
             color=TEAL, bold=True, align=PP_ALIGN.CENTER)


def add_picture_contain(slide, path, x, y, w, h):
    with Image.open(path) as image:
        ratio = image.width / image.height
    target = w / h
    if ratio > target:
        pw, ph = w, w / ratio
    else:
        ph, pw = h, h * ratio
    slide.shapes.add_picture(str(path), Inches(x + (w - pw) / 2),
                             Inches(y + (h - ph) / 2), Inches(pw), Inches(ph))


def make_qr():
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H,
                       box_size=12, border=4)
    qr.add_data(GITHUB_URL)
    qr.make(fit=True)
    image = qr.make_image(fill_color="#17365D", back_color="white").convert("RGB")
    image.save(QR_PATH, quality=100)


def build_pptx():
    make_qr()
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = rgb(WHITE)

    # Institutional header and title.
    add_text(slide, "ANGLIA RUSKIN UNIVERSITY", 0.55, 0.24, 3.0, 0.24,
             size=10.5, color=TEAL, bold=True)
    add_text(slide, "FINAL YEAR PROJECT  ·  BEng COMPUTER SCIENCE",
             7.25, 0.24, 5.7, 0.24, size=10, color=MUTED,
             align=PP_ALIGN.CENTER)
    slide.shapes.add_picture(str(ASSETS / "aru-logo.png"), Inches(15.25),
                             Inches(0.12), width=Inches(0.72))
    add_text(slide, "PadhSang", 0.55, 0.67, 6.0, 0.72,
             size=34, color=NAVY, bold=True)
    add_text(slide, "Secure collaboration for student projects",
             0.57, 1.38, 7.8, 0.4, size=17, color=NAVY)
    add_rect(slide, 0.55, 1.86, 1.25, 0.07, fill=AMBER)
    add_rect(slide, 1.8, 1.86, 14.15, 0.07, fill=TEAL)

    # Short opening statement (21 words) and research question.
    add_text(slide, "PROJECT STATEMENT", 0.55, 2.08, 1.35, 0.28,
             size=10.5, color=TEAL, bold=True)
    add_text(slide, SUMMARY, 2.35, 2.04, 13.6, 0.45,
             size=13.5, color=INK, bold=False, valign=MSO_ANCHOR.MIDDLE)
    add_rect(slide, 0.55, 2.59, 15.4, 0.58, fill=PALE_BLUE, line=LINE, radius=True)
    add_rect(slide, 0.55, 2.59, 0.1, 0.58, fill=AMBER)
    add_text(slide, "RESEARCH QUESTION", 0.79, 2.73, 1.6, 0.24,
             size=10, color=TEAL, bold=True)
    add_text(slide, RESEARCH_QUESTION, 2.42, 2.68, 13.15, 0.34,
             size=14, color=NAVY, bold=True, valign=MSO_ANCHOR.MIDDLE)

    # Three big numbers directly below the intro.
    add_rect(slide, 0.55, 3.32, 15.4, 0.93, fill="F8FAFB", line=LINE, radius=True)
    add_metric(slide, "25/25", "automated checks passed", 1.15, 3.39, 3.8)
    add_metric(slide, "5/5", "browser workflows passed", 6.35, 3.39, 3.8)
    add_metric(slide, "12", "production database tables", 11.5, 3.39, 3.8)
    add_rect(slide, 5.72, 3.48, 0.012, 0.58, fill=LINE)
    add_rect(slide, 10.88, 3.48, 0.012, 0.58, fill=LINE)

    # Three-column body.
    x1, x2, x3 = 0.55, 5.52, 11.05
    w1, w2, w3 = 4.55, 5.08, 4.9
    add_rect(slide, 5.31, 4.55, 0.012, 6.33, fill=LINE)
    add_rect(slide, 10.83, 4.55, 0.012, 6.33, fill=LINE)

    add_section_heading(slide, "01", "THE PROBLEM", x1, 4.55, w1)
    add_body(slide, [
        "Student teams often split project discussions, assigned work and deadlines across several tools.",
        "This makes responsibilities harder to track and increases the risk of exposing project information to the wrong user.",
    ], x1, 5.04, w1, 1.08, 12.5)

    add_section_heading(slide, "02", "OBJECTIVES", x1, 6.22, w1)
    add_body(slide, [
        "• Combine shared projects, tasks and discussion in one workspace.",
        "• Protect project data with OAuth and server-side permission checks.",
        "• Support private planning, reminders and focused study.",
    ], x1, 6.7, w1, 1.34, 12.2)

    add_section_heading(slide, "03", "SECURITY BY DESIGN", x1, 8.18, w1)
    add_body(slide, [
        "• Database-backed authenticated sessions",
        "• Owner, member and assignee permission checks",
        "• Random invitation tokens stored only as hashes",
        "• Seven-day invitation expiry and revocation",
        "• Transactional deadline-extension decisions",
        "• Safe internal redirect validation",
    ], x1, 8.66, w1, 1.86, 11.8)
    add_text(slide, "Scope  |  Student project collaboration and personal study planning.",
             x1, 10.58, w1, 0.28, size=9.5, color=MUTED)

    add_section_heading(slide, "04", "HOW THE SYSTEM WORKS", x2, 4.55, w2)
    flow_y = 5.06
    flow = [
        ("1  SIGN IN", "Google / Microsoft OAuth"),
        ("2  SERVER CHECK", "Auth.js session and role validation"),
        ("3  COLLABORATE", "Projects, tasks, messages and reminders"),
        ("4  PERSIST", "Prisma saves authorised changes in PostgreSQL"),
    ]
    for i, (title, detail) in enumerate(flow):
        yy = flow_y + i * 0.53
        add_rect(slide, x2 + 0.28, yy, w2 - 0.56, 0.43,
                 fill=PALE if i % 2 == 0 else PALE_BLUE, line=LINE)
        add_text(slide, title, x2 + 0.43, yy + 0.06, 1.58, 0.18,
                 size=11.5, color=NAVY, bold=True)
        add_text(slide, detail, x2 + 2.03, yy + 0.06, w2 - 2.45, 0.2,
                 size=9.7, color=INK)
        if i < len(flow) - 1:
            add_text(slide, "↓", x2 + w2 / 2 - 0.1, yy + 0.4, 0.2, 0.17,
                     size=11, color=TEAL, bold=True, align=PP_ALIGN.CENTER)

    add_text(slide, "APPLICATION EVIDENCE", x2, 7.26, w2, 0.27,
             size=15.5, color=NAVY, bold=True)
    add_rect(slide, x2, 7.58, w2, 2.43, fill="FAFCFD", line=LINE)
    add_picture_contain(slide, ASSETS / "dashboard.png", x2 + 0.12, 7.67, 2.32, 1.95)
    add_picture_contain(slide, ASSETS / "project.png", x2 + 2.61, 7.67, 2.32, 1.95)
    add_text(slide, "Personal dashboard", x2 + 0.18, 9.65, 2.18, 0.2,
             size=9, color=MUTED, align=PP_ALIGN.CENTER)
    add_text(slide, "Project workflow", x2 + 2.68, 9.65, 2.18, 0.2,
             size=9, color=MUTED, align=PP_ALIGN.CENTER)
    add_text(slide, "Next.js  ·  TypeScript  ·  Auth.js  ·  Prisma  ·  PostgreSQL",
             x2, 10.18, w2, 0.28, size=10.3, color=TEAL, bold=True,
             align=PP_ALIGN.CENTER)
    add_text(slide, "Local and browser tests use isolated SQLite databases and synthetic accounts.",
             x2, 10.5, w2, 0.26, size=9.5, color=MUTED,
             align=PP_ALIGN.CENTER)

    add_section_heading(slide, "05", "RESULTS & FINDINGS", x3, 4.55, w3)
    add_body(slide, [
        "• 25 service/security tests and five browser workflows passed.",
        "• Non-members were denied private-project access.",
        "• Concurrent extension decisions produced one consistent outcome.",
        "• Production build and PostgreSQL migration passed.",
    ], x3, 5.04, w3, 1.75, 12.1)
    add_rect(slide, x3, 6.84, w3, 0.68, fill=PALE_BLUE, line=LINE, radius=True)
    add_text(slide, "Finding", x3 + 0.16, 6.96, 0.7, 0.2,
             size=11, color=TEAL, bold=True)
    add_text(slide, "Security depended on external OAuth and hosting configuration as well as application code.",
             x3 + 0.85, 6.91, w3 - 1.02, 0.36, size=11.2, color=NAVY, bold=True)

    add_section_heading(slide, "06", "LIMITATIONS & NEXT STEPS", x3, 7.74, w3)
    add_body(slide, [
        "• Complete live Microsoft provider verification.",
        "• Add real-time discussion and optional email reminders.",
        "• Conduct student usability testing and an independent security review.",
        "• Restore reviewed production hosting for live demonstrations.",
    ], x3, 8.23, w3, 1.26, 11.8)

    add_section_heading(slide, "07", "CONCLUSION", x3, 9.6, 3.25)
    add_text(slide,
             "PadhSang combines secure authentication, role-based access and practical study tools in one student workspace.",
             x3, 10.08, 3.25, 0.72, size=11.8, color=INK)
    slide.shapes.add_picture(str(QR_PATH), Inches(14.48), Inches(9.62),
                             width=Inches(1.22), height=Inches(1.22))
    add_text(slide, "VIEW SOURCE", 14.44, 10.85, 1.3, 0.2,
             size=8.5, color=TEAL, bold=True, align=PP_ALIGN.CENTER)

    # References and identity footer.
    add_rect(slide, 0.55, 11.02, 15.4, 0.012, fill=NAVY)
    add_text(slide,
             "References  |  OWASP Authentication Cheat Sheet; Auth.js documentation; Next.js documentation; Prisma documentation.",
             0.55, 11.08, 10.5, 0.2, size=7.8, color=MUTED)
    add_text(slide,
             "Deepesh Kumar  ·  BEng Computer Science  ·  SID: 2327937  ·  Supervisor: Priyanka Sharma",
             0.55, 11.37, 15.4, 0.22, size=9.2, color=NAVY, bold=True)

    prs.save(PPTX_OUT)


class InchCanvas:
    def __init__(self, base, sx, sy):
        self.base, self.sx, self.sy = base, sx, sy

    def __getattr__(self, name):
        return getattr(self.base, name)

    def setFont(self, name, points):
        self.base.setFont(name, points)

    def rect(self, x, y, w, h, *args, **kwargs):
        self.base.rect(x * self.sx, y * self.sy, w * self.sx, h * self.sy, *args, **kwargs)

    def roundRect(self, x, y, w, h, r, *args, **kwargs):
        self.base.roundRect(x * self.sx, y * self.sy, w * self.sx, h * self.sy,
                            r * min(self.sx, self.sy), *args, **kwargs)

    def drawString(self, x, y, text):
        self.base.drawString(x * self.sx, y * self.sy, text)

    def drawCentredString(self, x, y, text):
        self.base.drawCentredString(x * self.sx, y * self.sy, text)

    def drawRightString(self, x, y, text):
        self.base.drawRightString(x * self.sx, y * self.sy, text)

    def drawImage(self, image, x, y, w, h, *args, **kwargs):
        self.base.drawImage(str(image), x * self.sx, y * self.sy, w * self.sx,
                            h * self.sy, *args, **kwargs)


def pdf_rect(c, x, y, w, h, fill=WHITE, stroke=None, radius=0):
    c.setFillColor(hc(fill))
    c.setStrokeColor(hc(stroke or fill))
    if radius:
        c.roundRect(x, H - y - h, w, h, radius, fill=1, stroke=1 if stroke else 0)
    else:
        c.rect(x, H - y - h, w, h, fill=1, stroke=1 if stroke else 0)


def pdf_text(c, text, x, y, w, h, size=13, color=INK, bold=False,
             align="left", leading=None):
    font = "Helvetica-Bold" if bold else "Helvetica"
    c.setFont(font, size)
    c.setFillColor(hc(color))
    chars = max(8, int(w * 72 / (size * 0.52)))
    lines = []
    for paragraph in text.split("\n"):
        lines.extend(wrap(paragraph, chars, break_long_words=False) or [""])
    yy = H - y - size / 72
    step = (leading or size * 1.15) / 72
    for line in lines:
        if yy < H - y - h:
            break
        if align == "center":
            c.drawCentredString(x + w / 2, yy, line)
        elif align == "right":
            c.drawRightString(x + w, yy, line)
        else:
            c.drawString(x, yy, line)
        yy -= step


def pdf_heading(c, number, title, x, y, w):
    pdf_text(c, f"{number}  {title}", x, y, w, 0.3, 18, NAVY, True)
    pdf_rect(c, x, y + 0.37, w, 0.012, LINE)
    pdf_rect(c, x, y + 0.37, 0.55, 0.055, TEAL)


def pdf_picture(c, path, x, y, w, h):
    with Image.open(path) as image:
        ratio = image.width / image.height
    target = w / h
    if ratio > target:
        pw, ph = w, w / ratio
    else:
        ph, pw = h, h * ratio
    c.drawImage(path, x + (w - pw) / 2, H - y - h + (h - ph) / 2,
                pw, ph, preserveAspectRatio=True, mask="auto")


def build_pdf():
    page = landscape(A3)
    base = canvas.Canvas(str(PDF_OUT), pagesize=page)
    pw, ph = page
    c = InchCanvas(base, pw / W, ph / H)
    pdf_rect(c, 0, 0, W, H, WHITE)
    pdf_text(c, "ANGLIA RUSKIN UNIVERSITY", 0.55, 0.24, 3, 0.24, 10.5, TEAL, True)
    pdf_text(c, "FINAL YEAR PROJECT  ·  BEng COMPUTER SCIENCE", 7.25, 0.24, 5.7, 0.24, 10, MUTED, False, "center")
    c.drawImage(ASSETS / "aru-logo.png", 15.25, H - 0.84, 0.72, 0.52, mask="auto")
    pdf_text(c, "PadhSang", 0.55, 0.67, 6, 0.72, 34, NAVY, True)
    pdf_text(c, "Secure collaboration for student projects", 0.57, 1.38, 7.8, 0.4, 17, NAVY)
    pdf_rect(c, 0.55, 1.86, 1.25, 0.07, AMBER); pdf_rect(c, 1.8, 1.86, 14.15, 0.07, TEAL)
    pdf_text(c, "PROJECT STATEMENT", 0.55, 2.08, 1.35, 0.28, 10.5, TEAL, True)
    pdf_text(c, SUMMARY, 2.35, 2.05, 13.6, 0.42, 13.5, INK)
    pdf_rect(c, 0.55, 2.59, 15.4, 0.58, PALE_BLUE, LINE, 0.08)
    pdf_rect(c, 0.55, 2.59, 0.1, 0.58, AMBER)
    pdf_text(c, "RESEARCH QUESTION", 0.79, 2.73, 1.6, 0.24, 10, TEAL, True)
    pdf_text(c, RESEARCH_QUESTION, 2.42, 2.7, 13.15, 0.3, 14, NAVY, True)
    pdf_rect(c, 0.55, 3.32, 15.4, 0.93, "F8FAFB", LINE, 0.08)
    metrics = [("25/25", "AUTOMATED CHECKS PASSED"), ("5/5", "BROWSER WORKFLOWS PASSED"), ("12", "PRODUCTION DATABASE TABLES")]
    for i, (value, label) in enumerate(metrics):
        xx = [1.15, 6.35, 11.5][i]
        pdf_text(c, value, xx, 3.42, 3.8, 0.45, 30, NAVY, True, "center")
        pdf_text(c, label, xx, 3.94, 3.8, 0.2, 9.5, TEAL, True, "center")
    pdf_rect(c, 5.72, 3.48, 0.012, 0.58, LINE); pdf_rect(c, 10.88, 3.48, 0.012, 0.58, LINE)
    x1, x2, x3 = 0.55, 5.52, 11.05
    w1, w2, w3 = 4.55, 5.08, 4.9
    pdf_rect(c, 5.31, 4.55, 0.012, 6.33, LINE); pdf_rect(c, 10.83, 4.55, 0.012, 6.33, LINE)
    pdf_heading(c, "01", "THE PROBLEM", x1, 4.55, w1)
    pdf_text(c, "Student teams often split project discussions, assigned work and deadlines across several tools.\n\nThis makes responsibilities harder to track and increases the risk of exposing project information to the wrong user.", x1, 5.04, w1, 1.08, 12.5)
    pdf_heading(c, "02", "OBJECTIVES", x1, 6.22, w1)
    pdf_text(c, "• Combine shared projects, tasks and discussion in one workspace.\n• Protect project data with OAuth and server-side permission checks.\n• Support private planning, reminders and focused study.", x1, 6.7, w1, 1.34, 12.2)
    pdf_heading(c, "03", "SECURITY BY DESIGN", x1, 8.18, w1)
    pdf_text(c, "• Database-backed authenticated sessions\n• Owner, member and assignee permission checks\n• Random invitation tokens stored only as hashes\n• Seven-day invitation expiry and revocation\n• Transactional deadline-extension decisions\n• Safe internal redirect validation", x1, 8.66, w1, 1.86, 11.8)
    pdf_text(c, "Scope  |  Student project collaboration and personal study planning.", x1, 10.58, w1, 0.28, 9.5, MUTED)
    pdf_heading(c, "04", "HOW THE SYSTEM WORKS", x2, 4.55, w2)
    flow = [("1  SIGN IN", "Google / Microsoft OAuth"), ("2  SERVER CHECK", "Auth.js session and role validation"), ("3  COLLABORATE", "Projects, tasks, messages and reminders"), ("4  PERSIST", "Prisma saves authorised changes in PostgreSQL")]
    for i, (title, detail) in enumerate(flow):
        yy = 5.06 + i * 0.53
        pdf_rect(c, x2 + 0.28, yy, w2 - 0.56, 0.43, PALE if i % 2 == 0 else PALE_BLUE, LINE)
        pdf_text(c, title, x2 + 0.43, yy + 0.08, 1.58, 0.18, 11.5, NAVY, True)
        pdf_text(c, detail, x2 + 2.03, yy + 0.08, w2 - 2.45, 0.2, 9.7, INK)
    pdf_text(c, "APPLICATION EVIDENCE", x2, 7.26, w2, 0.27, 15.5, NAVY, True)
    pdf_rect(c, x2, 7.58, w2, 2.43, "FAFCFD", LINE)
    pdf_picture(c, ASSETS / "dashboard.png", x2 + 0.12, 7.67, 2.32, 1.95)
    pdf_picture(c, ASSETS / "project.png", x2 + 2.61, 7.67, 2.32, 1.95)
    pdf_text(c, "Personal dashboard", x2 + 0.18, 9.65, 2.18, 0.2, 9, MUTED, False, "center")
    pdf_text(c, "Project workflow", x2 + 2.68, 9.65, 2.18, 0.2, 9, MUTED, False, "center")
    pdf_text(c, "Next.js  ·  TypeScript  ·  Auth.js  ·  Prisma  ·  PostgreSQL", x2, 10.18, w2, 0.28, 10.3, TEAL, True, "center")
    pdf_text(c, "Local and browser tests use isolated SQLite databases and synthetic accounts.", x2, 10.5, w2, 0.26, 9.5, MUTED, False, "center")
    pdf_heading(c, "05", "RESULTS & FINDINGS", x3, 4.55, w3)
    pdf_text(c, "• 25 service/security tests and five browser workflows passed.\n• Non-members were denied private-project access.\n• Concurrent extension decisions produced one consistent outcome.\n• Production build and PostgreSQL migration passed.", x3, 5.04, w3, 1.75, 12.1)
    pdf_rect(c, x3, 6.84, w3, 0.68, PALE_BLUE, LINE, 0.08)
    pdf_text(c, "Finding", x3 + 0.16, 6.96, 0.7, 0.2, 11, TEAL, True)
    pdf_text(c, "Security depended on external OAuth and hosting configuration as well as application code.", x3 + 0.85, 6.91, w3 - 1.02, 0.36, 11.2, NAVY, True)
    pdf_heading(c, "06", "LIMITATIONS & NEXT STEPS", x3, 7.74, w3)
    pdf_text(c, "• Complete live Microsoft provider verification.\n• Add real-time discussion and optional email reminders.\n• Conduct student usability testing and an independent security review.\n• Restore reviewed production hosting for live demonstrations.", x3, 8.23, w3, 1.26, 11.8)
    pdf_heading(c, "07", "CONCLUSION", x3, 9.6, 3.25)
    pdf_text(c, "PadhSang combines secure authentication, role-based access and practical study tools in one student workspace.", x3, 10.08, 3.25, 0.72, 11.8, INK)
    c.drawImage(QR_PATH, 14.48, H - 10.84, 1.22, 1.22, mask="auto")
    pdf_text(c, "VIEW SOURCE", 14.44, 10.85, 1.3, 0.2, 8.5, TEAL, True, "center")
    pdf_rect(c, 0.55, 11.02, 15.4, 0.012, NAVY)
    pdf_text(c, "References  |  OWASP Authentication Cheat Sheet; Auth.js documentation; Next.js documentation; Prisma documentation.", 0.55, 11.08, 10.5, 0.2, 7.8, MUTED)
    pdf_text(c, "Deepesh Kumar  ·  BEng Computer Science  ·  SID: 2327937  ·  Supervisor: Priyanka Sharma", 0.55, 11.37, 15.4, 0.22, 9.2, NAVY, True)
    base.showPage(); base.save()


if __name__ == "__main__":
    assert len(SUMMARY.replace(".", "").split()) <= 25
    build_pptx()
    build_pdf()
    print(PPTX_OUT)
    print(PDF_OUT)
