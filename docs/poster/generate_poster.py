from pathlib import Path
from textwrap import wrap

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt
from reportlab.lib.colors import HexColor as _HexColor, white
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PPTX_PATH = OUT / "PadhSang_Poster_A1_Landscape.pptx"
PDF_PATH = OUT / "PadhSang_Poster_A1_Landscape.pdf"
A3_PPTX_PATH = OUT / "PadhSang_Poster_A3_Landscape.pptx"
A3_PDF_PATH = OUT / "PadhSang_Poster_A3_Landscape.pdf"

SCREENSHOTS = {
    "dashboard": next((ROOT / "test-results").rglob("dashboard-desktop.png")),
    "project": next((ROOT / "test-results").rglob("project-desktop.png")),
}

W, H = 33.1, 23.4
NAVY = "172554"
INDIGO = "4F46E5"
VIOLET = "7C3AED"
CYAN = "0891B2"
INK = "172033"
MUTED = "536178"
PALE = "EEF2FF"
PALE_CYAN = "ECFEFF"
LINE = "CBD5E1"
WHITE = "FFFFFF"
GREEN = "047857"
AMBER = "B45309"


def HexColor(value):
    return _HexColor(value if value.startswith("#") else f"#{value}")


class ScaledCanvas:
    """Expose inch-based drawing while keeping ReportLab text metrics in points."""

    def __init__(self, base, sx, sy):
        self.base = base
        self.sx = sx
        self.sy = sy

    def __getattr__(self, name):
        return getattr(self.base, name)

    def setFont(self, name, size):
        self.base.setFont(name, size * self.sy)

    def drawString(self, x, y, text):
        self.base.drawString(x * self.sx, y * self.sy, text)

    def drawCentredString(self, x, y, text):
        self.base.drawCentredString(x * self.sx, y * self.sy, text)

    def drawRightString(self, x, y, text):
        self.base.drawRightString(x * self.sx, y * self.sy, text)

    def rect(self, x, y, w, h, *args, **kwargs):
        self.base.rect(x * self.sx, y * self.sy, w * self.sx, h * self.sy, *args, **kwargs)

    def roundRect(self, x, y, w, h, radius, *args, **kwargs):
        self.base.roundRect(x * self.sx, y * self.sy, w * self.sx, h * self.sy,
                            radius * min(self.sx, self.sy), *args, **kwargs)

    def drawImage(self, image, x, y, w, h, *args, **kwargs):
        self.base.drawImage(image, x * self.sx, y * self.sy, w * self.sx, h * self.sy,
                            *args, **kwargs)


def rgb(hex_value):
    return RGBColor.from_string(hex_value)


def add_box(slide, x, y, w, h, fill=WHITE, line=LINE, radius=True):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    shape.line.color.rgb = rgb(line)
    shape.line.width = Pt(1.2)
    return shape


def add_text(slide, text, x, y, w, h, size=20, color=INK, bold=False,
             align=PP_ALIGN.LEFT, font="Aptos", margin=0.08,
             valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.text = text
    p.font.name = font
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.color.rgb = rgb(color)
    p.space_before = Pt(0)
    p.space_after = Pt(0)
    p.line_spacing = 1.0
    return box


def add_rich_text(slide, title, body, x, y, w, h, accent=INDIGO,
                  title_size=25, body_size=18):
    add_box(slide, x, y, w, h)
    add_box(slide, x, y, 0.12, h, fill=accent, line=accent, radius=False)
    add_text(slide, title, x + 0.35, y + 0.22, w - 0.65, 0.45,
             size=title_size, color=NAVY, bold=True)
    box = slide.shapes.add_textbox(
        Inches(x + 0.35), Inches(y + 0.82), Inches(w - 0.65), Inches(h - 1.02)
    )
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = tf.margin_right = Inches(0.02)
    tf.margin_top = tf.margin_bottom = Inches(0.04)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    for index, item in enumerate(body):
        p = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        p.text = item[1:] if item.startswith("•") else item
        p.level = 0
        p.font.name = "Aptos"
        p.font.size = Pt(body_size)
        p.font.color.rgb = rgb(INK)
        p.alignment = PP_ALIGN.LEFT
        p.space_before = Pt(0)
        p.space_after = Pt(7)
        p.line_spacing = 1.05
        if item.startswith("•"):
            p.text = "•  " + p.text.strip()
    return box


def add_picture_contain(slide, path, x, y, w, h):
    with Image.open(path) as image:
        ratio = image.width / image.height
    target = w / h
    if ratio > target:
        pw, ph = w, w / ratio
    else:
        ph, pw = h, h * ratio
    px, py = x + (w - pw) / 2, y + (h - ph) / 2
    slide.shapes.add_picture(str(path), Inches(px), Inches(py), Inches(pw), Inches(ph))


def add_stat(slide, value, label, x, y, w, color=INDIGO):
    add_box(slide, x, y, w, 1.22, fill=PALE, line=PALE)
    add_text(slide, value, x + 0.12, y + 0.12, w - 0.24, 0.54,
             size=29, color=color, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, label, x + 0.12, y + 0.67, w - 0.24, 0.32,
             size=14, color=MUTED, bold=True, align=PP_ALIGN.CENTER)


def build_pptx():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.background.fill
    bg.solid()
    bg.fore_color.rgb = rgb("F8FAFC")

    add_box(slide, 0, 0, W, 2.75, fill=NAVY, line=NAVY, radius=False)
    add_box(slide, 0, 2.75, W, 0.12, fill=VIOLET, line=VIOLET, radius=False)
    add_text(slide, "PS", 0.75, 0.48, 1.45, 1.45, size=39, color=WHITE,
             bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    logo = slide.shapes[-1]
    logo.fill.solid(); logo.fill.fore_color.rgb = rgb(INDIGO)
    logo.line.color.rgb = rgb("818CF8")
    add_text(slide, "PadhSang", 2.45, 0.38, 14.5, 0.9,
             size=56, color=WHITE, bold=True)
    add_text(slide, "A secure collaborative workspace for student projects",
             2.5, 1.32, 18.8, 0.55, size=26, color="C7D2FE")
    add_text(slide, "PLAN. COLLABORATE. PROGRESS.", 22.5, 0.66, 9.6, 0.62,
             size=24, color=WHITE, bold=True, align=PP_ALIGN.RIGHT)
    add_text(slide, "Deepesh Kumar  •  SID 2327937  •  Supervisor: Priyanka Sharma",
             17.2, 1.53, 14.9, 0.45, size=18, color="C7D2FE", align=PP_ALIGN.RIGHT)

    add_box(slide, 0.72, 3.18, 31.65, 2.0, fill=PALE, line="C7D2FE")
    add_text(slide,
             "I built, tested and investigated PadhSang to answer how third-party authentication and "
             "server-side authorisation can support secure student collaboration.",
             1.1, 3.48, 30.9, 0.72, size=27, color=NAVY, bold=True,
             align=PP_ALIGN.CENTER)
    add_text(slide,
             "The tested system passed 25/25 automated checks and 5/5 complete browser workflows.",
             2.0, 4.35, 29.1, 0.42, size=21, color=INDIGO, bold=True,
             align=PP_ALIGN.CENTER)

    x1, x2, x3 = 0.72, 11.38, 22.04
    cw = 10.33

    add_rich_text(slide, "Problem & aim", [
        "Student teams often split discussions, deadlines and personal planning across different tools.",
        "Aim: design and evaluate one secure workspace for project collaboration and focused study.",
        "Research question: How can OAuth and server-side access control protect a practical student workspace?",
    ], x1, 5.55, cw, 4.15, accent=VIOLET, body_size=18)

    add_rich_text(slide, "What I built", [
        "• Google and Microsoft OAuth support",
        "• Project invitations and membership",
        "• Assigned tasks, priorities and deadlines",
        "• Extension requests and owner decisions",
        "• Discussion and task feedback",
        "• In-app reminders and private planner",
        "• Persistent 25-minute focus timer",
    ], x1, 9.98, cw, 6.45, accent=INDIGO, body_size=18)

    add_box(slide, x1, 16.72, cw, 5.55)
    add_text(slide, "Secure architecture", x1 + 0.35, 16.98, cw - 0.7, 0.42,
             size=25, color=NAVY, bold=True)
    labels = [
        ("Student", CYAN),
        ("Google / Microsoft\nOAuth", INDIGO),
        ("Next.js + Auth.js\nserver checks", VIOLET),
        ("Prisma + PostgreSQL", GREEN),
    ]
    bx, by, bw, bh = x1 + 0.45, 18.02, 2.05, 1.32
    for i, (label, colour) in enumerate(labels):
        xx = bx + i * 2.42
        add_box(slide, xx, by, bw, bh, fill=colour, line=colour)
        add_text(slide, label, xx + 0.08, by + 0.12, bw - 0.16, bh - 0.2,
                 size=15, color=WHITE, bold=True, align=PP_ALIGN.CENTER,
                 valign=MSO_ANCHOR.MIDDLE)
        if i < len(labels) - 1:
            add_text(slide, "→", xx + bw + 0.06, by + 0.39, 0.3, 0.4,
                     size=25, color=MUTED, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide,
             "Membership and ownership are checked on every protected server operation. Invitation tokens are random, hashed and expire after seven days.",
             x1 + 0.48, 19.75, cw - 0.96, 1.5, size=17, color=INK,
             align=PP_ALIGN.CENTER)

    add_box(slide, x2, 5.55, cw, 10.42)
    add_text(slide, "Application evidence", x2 + 0.35, 5.82, cw - 0.7, 0.45,
             size=25, color=NAVY, bold=True)
    add_picture_contain(slide, SCREENSHOTS["dashboard"], x2 + 0.4, 6.48, cw - 0.8, 4.1)
    add_text(slide, "Personal dashboard: assigned work, planner and focus timer",
             x2 + 0.5, 10.56, cw - 1, 0.34, size=15, color=MUTED,
             align=PP_ALIGN.CENTER)
    add_picture_contain(slide, SCREENSHOTS["project"], x2 + 0.4, 11.12, cw - 0.8, 4.0)
    add_text(slide, "Project workspace: permissions, task workflow and discussion",
             x2 + 0.5, 15.11, cw - 1, 0.34, size=15, color=MUTED,
             align=PP_ALIGN.CENTER)

    add_box(slide, x2, 16.27, cw, 6.0)
    add_text(slide, "Testing & results", x2 + 0.35, 16.55, cw - 0.7, 0.45,
             size=25, color=NAVY, bold=True)
    add_stat(slide, "25/25", "SERVICE + SECURITY TESTS", x2 + 0.42, 17.3, 2.85)
    add_stat(slide, "5/5", "BROWSER WORKFLOWS", x2 + 3.51, 17.3, 2.85, VIOLET)
    add_stat(slide, "12", "DATABASE TABLES", x2 + 6.6, 17.3, 2.85, CYAN)
    add_text(slide,
             "Covered data isolation, task ownership, project membership, invitations, extension decisions, feedback, timer persistence and responsive layouts.",
             x2 + 0.45, 18.84, cw - 0.9, 1.15, size=18, color=INK,
             align=PP_ALIGN.CENTER)
    add_box(slide, x2 + 0.72, 20.24, cw - 1.44, 1.18, fill="ECFDF5", line="A7F3D0")
    add_text(slide, "✓ Production build passed   ✓ PostgreSQL migration passed",
             x2 + 0.9, 20.48, cw - 1.8, 0.42, size=19, color=GREEN,
             bold=True, align=PP_ALIGN.CENTER)

    add_rich_text(slide, "What I found", [
        "Testing indicated that the implemented server-side checks separated personal and project data in the tested scenarios.",
        "Members completed assigned workflows, while non-members were denied project access.",
        "Security also depended on external OAuth, database and hosting configuration—not only application code.",
    ], x3, 5.55, cw, 5.15, accent=GREEN, body_size=18)

    add_rich_text(slide, "Security decisions", [
        "• Database-backed authenticated sessions",
        "• Owner/member/assignee permission checks",
        "• Hashed, expiring invitation tokens",
        "• Transactional extension decisions",
        "• Safe internal redirect validation",
        "• No production test-login bypass",
    ], x3, 10.98, cw, 4.9, accent=CYAN, body_size=18)

    add_rich_text(slide, "Limitations", [
        "• Microsoft live sign-in still needs provider credentials and real-account verification.",
        "• Discussion refresh is manual; reminders are in-app only.",
        "• Automated checks are not a formal penetration test or user study.",
        "• Initial hosting was suspended pending provider review.",
    ], x3, 16.16, cw, 3.75, accent=AMBER, body_size=17)

    add_box(slide, x3, 20.18, cw, 2.09, fill=NAVY, line=NAVY)
    add_text(slide, "Conclusion", x3 + 0.35, 20.42, 2.5, 0.4,
             size=24, color=WHITE, bold=True)
    add_text(slide,
             "PadhSang demonstrates that secure authentication, role-based access and collaborative study tools can be combined in one practical student workspace.",
             x3 + 0.35, 20.9, cw - 0.7, 0.95, size=18, color="E0E7FF")

    add_text(slide,
             "Source: github.com/deepeshkumarbangrwa-sys/study-sync   •   Evidence uses isolated synthetic test accounts   •   References: OWASP Authentication Cheat Sheet; Auth.js; Next.js; Prisma",
             0.8, 22.75, 31.5, 0.34, size=13, color=MUTED,
             align=PP_ALIGN.CENTER)
    prs.save(PPTX_PATH)


def build_a3_pptx():
    """Scale the editable A1 slide to exact A3 landscape dimensions."""
    prs = Presentation(PPTX_PATH)
    original_width = prs.slide_width
    original_height = prs.slide_height
    target_width = Inches(16.5354)
    target_height = Inches(11.6929)
    sx = target_width / original_width
    sy = target_height / original_height
    text_scale = min(sx, sy)
    prs.slide_width = target_width
    prs.slide_height = target_height
    for slide in prs.slides:
        for shape in slide.shapes:
            shape.left = int(shape.left * sx)
            shape.top = int(shape.top * sy)
            shape.width = int(shape.width * sx)
            shape.height = int(shape.height * sy)
            if getattr(shape, "has_text_frame", False):
                frame = shape.text_frame
                frame.margin_left = int(frame.margin_left * sx)
                frame.margin_right = int(frame.margin_right * sx)
                frame.margin_top = int(frame.margin_top * sy)
                frame.margin_bottom = int(frame.margin_bottom * sy)
                for paragraph in frame.paragraphs:
                    if paragraph.font.size:
                        paragraph.font.size = int(paragraph.font.size * text_scale)
                    if paragraph.space_before:
                        paragraph.space_before = int(paragraph.space_before * text_scale)
                    if paragraph.space_after:
                        paragraph.space_after = int(paragraph.space_after * text_scale)
                    for run in paragraph.runs:
                        if run.font.size:
                            run.font.size = int(run.font.size * text_scale)
            try:
                if shape.line.width:
                    shape.line.width = int(shape.line.width * text_scale)
            except (AttributeError, TypeError):
                pass
    prs.save(A3_PPTX_PATH)


def draw_wrapped(c, text, x, y, width, font="Helvetica", size=17/72,
                 colour=INK, leading=None, bullet=False):
    leading = leading or size * 1.26
    c.setFont(font, size)
    c.setFillColor(HexColor(colour))
    chars = max(18, int(width / (size * 0.52)))
    lines = wrap(text, chars, break_long_words=False)
    for line in lines:
        c.drawString(x, y, ("• " if bullet and line == lines[0] else "  " if bullet else "") + line)
        y -= leading
    return y


def pdf_box(c, x, y, w, h, fill=WHITE, stroke=LINE, radius=0.12):
    c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(stroke)); c.setLineWidth(1)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def pdf_card(c, title, items, x, y_top, w, h, accent=INDIGO, body_size=17/72):
    y = y_top - h
    pdf_box(c, x, y, w, h)
    c.setFillColor(HexColor(accent)); c.rect(x, y, 0.12, h, fill=1, stroke=0)
    c.setFillColor(HexColor(NAVY)); c.setFont("Helvetica-Bold", 24/72)
    c.drawString(x + 0.28, y_top - 0.47, title)
    yy = y_top - 0.94
    for item in items:
        bullet = item.startswith("•")
        yy = draw_wrapped(c, item[1:].strip() if bullet else item, x + 0.30, yy,
                          w - 0.58, size=body_size, bullet=bullet)
        yy -= 0.11


def pdf_image_contain(c, path, x, y, w, h):
    with Image.open(path) as image:
        ratio = image.width / image.height
    target = w / h
    if ratio > target:
        pw, ph = w, w / ratio
    else:
        ph, pw = h, h * ratio
    c.drawImage(str(path), x + (w - pw) / 2, y + (h - ph) / 2,
                pw, ph, preserveAspectRatio=True, mask="auto")


def build_pdf(path=PDF_PATH, page=None):
    # A1 landscape by default; the same logical grid scales cleanly to A3.
    page = page or landscape((1683.78, 2383.94))
    base = canvas.Canvas(str(path), pagesize=page)
    pw, ph = page
    sx, sy = pw / W, ph / H
    c = ScaledCanvas(base, sx, sy)

    c.setFillColor(HexColor("F8FAFC")); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor(NAVY)); c.rect(0, H - 2.75, W, 2.75, fill=1, stroke=0)
    c.setFillColor(HexColor(VIOLET)); c.rect(0, H - 2.87, W, 0.12, fill=1, stroke=0)
    c.setFillColor(HexColor(INDIGO)); c.roundRect(0.75, H - 1.95, 1.45, 1.45, 0.2, fill=1, stroke=0)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 0.55); c.drawCentredString(1.475, H - 1.45, "PS")
    c.setFont("Helvetica-Bold", 0.78); c.drawString(2.45, H - 1.13, "PadhSang")
    c.setFillColor(HexColor("C7D2FE")); c.setFont("Helvetica", 0.36)
    c.drawString(2.5, H - 1.88, "A secure collaborative workspace for student projects")
    c.setFillColor(white); c.setFont("Helvetica-Bold", 0.34)
    c.drawRightString(32.1, H - 1.05, "PLAN. COLLABORATE. PROGRESS.")
    c.setFillColor(HexColor("C7D2FE")); c.setFont("Helvetica", 0.23)
    c.drawRightString(32.1, H - 1.78, "Deepesh Kumar  •  SID 2327937  •  Supervisor: Priyanka Sharma")

    pdf_box(c, 0.72, H - 5.18, 31.65, 2.0, fill=PALE, stroke="C7D2FE")
    c.setFillColor(HexColor(NAVY)); c.setFont("Helvetica-Bold", 0.37)
    c.drawCentredString(W / 2, H - 3.92,
        "I built, tested and investigated PadhSang to answer how third-party authentication")
    c.drawCentredString(W / 2, H - 4.34,
        "and server-side authorisation can support secure student collaboration.")
    c.setFillColor(HexColor(INDIGO)); c.setFont("Helvetica-Bold", 0.29)
    c.drawCentredString(W / 2, H - 4.82,
        "The tested system passed 25/25 automated checks and 5/5 complete browser workflows.")

    x1, x2, x3, cw = 0.72, 11.38, 22.04, 10.33
    top = H - 5.55
    pdf_card(c, "Problem & aim", [
        "Student teams often split discussions, deadlines and personal planning across different tools.",
        "Aim: design and evaluate one secure workspace for project collaboration and focused study.",
        "Research question: How can OAuth and server-side access control protect a practical student workspace?",
    ], x1, top, cw, 4.15, VIOLET, 18/72)
    pdf_card(c, "What I built", [
        "• Google and Microsoft OAuth support", "• Project invitations and membership",
        "• Assigned tasks, priorities and deadlines", "• Extension requests and owner decisions",
        "• Discussion and task feedback", "• In-app reminders and private planner",
        "• Persistent 25-minute focus timer",
    ], x1, H - 9.98, cw, 6.45, INDIGO, 18/72)
    pdf_card(c, "Secure architecture", [
        "Student → Google/Microsoft OAuth → Next.js/Auth.js server checks → Prisma/PostgreSQL",
        "Membership and ownership are checked on protected operations. Invitation tokens are random, hashed and expire after seven days.",
    ], x1, H - 16.72, cw, 5.55, CYAN, 17/72)

    pdf_box(c, x2, H - 15.97, cw, 10.42)
    c.setFillColor(HexColor(NAVY)); c.setFont("Helvetica-Bold", 24/72)
    c.drawString(x2 + 0.35, H - 6.12, "Application evidence")
    pdf_image_contain(c, SCREENSHOTS["dashboard"], x2 + 0.4, H - 10.58, cw - 0.8, 4.1)
    c.setFillColor(HexColor(MUTED)); c.setFont("Helvetica", 14/72)
    c.drawCentredString(x2 + cw/2, H - 10.84, "Personal dashboard: assigned work, planner and focus timer")
    pdf_image_contain(c, SCREENSHOTS["project"], x2 + 0.4, H - 15.12, cw - 0.8, 4.0)
    c.drawCentredString(x2 + cw/2, H - 15.42, "Project workspace: permissions, task workflow and discussion")

    pdf_box(c, x2, H - 22.27, cw, 6.0)
    c.setFillColor(HexColor(NAVY)); c.setFont("Helvetica-Bold", 24/72)
    c.drawString(x2 + 0.35, H - 16.9, "Testing & results")
    stats = [("25/25", "SERVICE + SECURITY TESTS", INDIGO),
             ("5/5", "BROWSER WORKFLOWS", VIOLET),
             ("12", "DATABASE TABLES", CYAN)]
    for i, (value, label, colour) in enumerate(stats):
        xx = x2 + 0.42 + i * 3.09
        pdf_box(c, xx, H - 18.52, 2.85, 1.22, fill=PALE, stroke=PALE)
        c.setFillColor(HexColor(colour)); c.setFont("Helvetica-Bold", 30/72)
        c.drawCentredString(xx + 1.425, H - 17.85, value)
        c.setFillColor(HexColor(MUTED)); c.setFont("Helvetica-Bold", 11/72)
        c.drawCentredString(xx + 1.425, H - 18.24, label)
    draw_wrapped(c,
        "Covered data isolation, task ownership, project membership, invitations, extension decisions, feedback, timer persistence and responsive layouts.",
        x2 + 0.48, H - 19.05, cw - 0.96, size=17/72)
    pdf_box(c, x2 + 0.72, H - 21.42, cw - 1.44, 1.18, fill="ECFDF5", stroke="A7F3D0")
    c.setFillColor(HexColor(GREEN)); c.setFont("Helvetica-Bold", 18/72)
    c.drawCentredString(x2 + cw/2, H - 20.92,
                        "Production build passed  •  PostgreSQL migration passed")

    pdf_card(c, "What I found", [
        "Testing indicated that the implemented server-side checks separated personal and project data in the tested scenarios.",
        "Members completed assigned workflows, while non-members were denied project access.",
        "Security also depended on external OAuth, database and hosting configuration—not only application code.",
    ], x3, top, cw, 5.15, GREEN, 18/72)
    pdf_card(c, "Security decisions", [
        "• Database-backed authenticated sessions", "• Owner/member/assignee permission checks",
        "• Hashed, expiring invitation tokens", "• Transactional extension decisions",
        "• Safe internal redirect validation", "• No production test-login bypass",
    ], x3, H - 10.98, cw, 4.9, CYAN, 18/72)
    pdf_card(c, "Limitations", [
        "• Microsoft live sign-in still needs provider credentials and real-account verification.",
        "• Discussion refresh is manual; reminders are in-app only.",
        "• Automated checks are not a formal penetration test or user study.",
        "• Initial hosting was suspended pending provider review.",
    ], x3, H - 16.16, cw, 3.75, AMBER, 16/72)
    pdf_box(c, x3, H - 22.27, cw, 2.09, fill=NAVY, stroke=NAVY)
    c.setFillColor(white); c.setFont("Helvetica-Bold", 24/72)
    c.drawString(x3 + 0.35, H - 20.7, "Conclusion")
    draw_wrapped(c,
        "PadhSang demonstrates that secure authentication, role-based access and collaborative study tools can be combined in one practical student workspace.",
        x3 + 0.35, H - 21.2, cw - 0.7, size=16/72, colour="E0E7FF")

    c.setFillColor(HexColor(MUTED)); c.setFont("Helvetica", 11/72)
    c.drawCentredString(W / 2, 0.35,
        "Source: github.com/deepeshkumarbangrwa-sys/study-sync  •  Evidence uses isolated synthetic test accounts  •  References: OWASP; Auth.js; Next.js; Prisma")
    c.showPage(); c.save()


if __name__ == "__main__":
    build_pptx()
    build_pdf()
    build_a3_pptx()
    build_pdf(A3_PDF_PATH, landscape(A3))
    print(PPTX_PATH)
    print(PDF_PATH)
    print(A3_PPTX_PATH)
    print(A3_PDF_PATH)
