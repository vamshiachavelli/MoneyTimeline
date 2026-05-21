import AppKit
import CoreGraphics
import Foundation

struct BrandColor {
    static let background = NSColor(calibratedRed: 5 / 255, green: 8 / 255, blue: 13 / 255, alpha: 1)
    static let elevated = NSColor(calibratedRed: 11 / 255, green: 17 / 255, blue: 26 / 255, alpha: 1)
    static let border = NSColor(calibratedRed: 37 / 255, green: 50 / 255, blue: 66 / 255, alpha: 1)
    static let text = NSColor(calibratedRed: 247 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)
    static let muted = NSColor(calibratedRed: 170 / 255, green: 183 / 255, blue: 198 / 255, alpha: 1)
    static let accent = NSColor(calibratedRed: 67 / 255, green: 216 / 255, blue: 139 / 255, alpha: 1)
    static let warning = NSColor(calibratedRed: 246 / 255, green: 166 / 255, blue: 59 / 255, alpha: 1)
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets", isDirectory: true)
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)

func writePNG(_ image: NSImage, to url: URL) throws {
    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:])
    else {
        throw NSError(domain: "MoneyTimelineAssets", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not encode PNG"])
    }
    try png.write(to: url)
}

func withImage(width: Int, height: Int, draw: (NSRect) -> Void) -> NSImage {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    draw(NSRect(x: 0, y: 0, width: width, height: height))
    image.unlockFocus()
    return image
}

func fillGradient(in rect: NSRect, radius: CGFloat) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    NSGraphicsContext.saveGraphicsState()
    path.addClip()
    NSGradient(starting: BrandColor.background, ending: BrandColor.elevated)?.draw(in: rect, angle: -35)
    NSGraphicsContext.restoreGraphicsState()
}

func strokeRoundedRect(_ rect: NSRect, radius: CGFloat, lineWidth: CGFloat, color: NSColor) {
    let path = NSBezierPath(roundedRect: rect.insetBy(dx: lineWidth / 2, dy: lineWidth / 2), xRadius: radius, yRadius: radius)
    color.setStroke()
    path.lineWidth = lineWidth
    path.stroke()
}

func fillCircle(center: CGPoint, diameter: CGFloat, color: NSColor) {
    color.setFill()
    NSBezierPath(ovalIn: NSRect(x: center.x - diameter / 2, y: center.y - diameter / 2, width: diameter, height: diameter)).fill()
}

func strokeCircle(center: CGPoint, diameter: CGFloat, lineWidth: CGFloat, color: NSColor) {
    color.setStroke()
    let path = NSBezierPath(ovalIn: NSRect(x: center.x - diameter / 2, y: center.y - diameter / 2, width: diameter, height: diameter))
    path.lineWidth = lineWidth
    path.stroke()
}

func strokeTrend(points: [CGPoint], lineWidth: CGFloat, color: NSColor) {
    let path = NSBezierPath()
    path.move(to: points[0])
    for point in points.dropFirst() {
        path.line(to: point)
    }
    path.lineWidth = lineWidth
    path.lineCapStyle = .round
    path.lineJoinStyle = .round
    color.setStroke()
    path.stroke()

    guard let last = points.last, points.count > 1 else { return }
    let previous = points[points.count - 2]
    let angle = atan2(last.y - previous.y, last.x - previous.x)
    let arrowLength = lineWidth * 2.2
    let arrowAngle = CGFloat.pi / 7
    let left = CGPoint(x: last.x - cos(angle - arrowAngle) * arrowLength, y: last.y - sin(angle - arrowAngle) * arrowLength)
    let right = CGPoint(x: last.x - cos(angle + arrowAngle) * arrowLength, y: last.y - sin(angle + arrowAngle) * arrowLength)
    let arrow = NSBezierPath()
    arrow.move(to: left)
    arrow.line(to: last)
    arrow.line(to: right)
    arrow.lineWidth = lineWidth * 0.72
    arrow.lineCapStyle = .round
    arrow.lineJoinStyle = .round
    arrow.stroke()
}

func drawMark(in rect: NSRect, includesTile: Bool) {
    let size = min(rect.width, rect.height)
    if includesTile {
        fillGradient(in: rect, radius: size * 0.23)
        strokeRoundedRect(rect, radius: size * 0.23, lineWidth: size * 0.012, color: BrandColor.border)
    }

    fillCircle(center: CGPoint(x: rect.midX, y: rect.midY), diameter: size * 0.64, color: BrandColor.accent.withAlphaComponent(0.10))
    strokeCircle(center: CGPoint(x: rect.midX, y: rect.midY), diameter: size * 0.49, lineWidth: size * 0.055, color: BrandColor.accent)

    strokeTrend(
        points: [
            CGPoint(x: rect.minX + size * 0.34, y: rect.minY + size * 0.42),
            CGPoint(x: rect.minX + size * 0.455, y: rect.minY + size * 0.53),
            CGPoint(x: rect.minX + size * 0.545, y: rect.minY + size * 0.48),
            CGPoint(x: rect.minX + size * 0.68, y: rect.minY + size * 0.62),
        ],
        lineWidth: size * 0.058,
        color: BrandColor.background
    )

    strokeTrend(
        points: [
            CGPoint(x: rect.minX + size * 0.34, y: rect.minY + size * 0.42),
            CGPoint(x: rect.minX + size * 0.455, y: rect.minY + size * 0.53),
            CGPoint(x: rect.minX + size * 0.545, y: rect.minY + size * 0.48),
            CGPoint(x: rect.minX + size * 0.68, y: rect.minY + size * 0.62),
        ],
        lineWidth: size * 0.038,
        color: BrandColor.accent
    )

    fillCircle(center: CGPoint(x: rect.minX + size * 0.72, y: rect.minY + size * 0.72), diameter: size * 0.105, color: BrandColor.background)
    fillCircle(center: CGPoint(x: rect.minX + size * 0.72, y: rect.minY + size * 0.72), diameter: size * 0.075, color: BrandColor.accent)
    fillCircle(center: CGPoint(x: rect.minX + size * 0.31, y: rect.minY + size * 0.35), diameter: size * 0.070, color: BrandColor.warning)
}

func drawCenteredText(_ text: String, y: CGFloat, width: CGFloat, fontSize: CGFloat, weight: NSFont.Weight, color: NSColor) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
    ]
    NSString(string: text).draw(in: NSRect(x: 0, y: y, width: width, height: fontSize * 1.35), withAttributes: attributes)
}

func drawWordmark(y: CGFloat, width: CGFloat, fontSize: CGFloat) {
    let font = NSFont.systemFont(ofSize: fontSize, weight: .heavy)
    let moneyAttrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: BrandColor.text]
    let timelineAttrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: BrandColor.accent]
    let money = NSAttributedString(string: "Money", attributes: moneyAttrs)
    let timeline = NSAttributedString(string: "Timeline", attributes: timelineAttrs)
    let totalWidth = money.size().width + timeline.size().width
    let startX = (width - totalWidth) / 2
    money.draw(at: CGPoint(x: startX, y: y))
    timeline.draw(at: CGPoint(x: startX + money.size().width, y: y))
}

let icon = withImage(width: 1024, height: 1024) { rect in
    BrandColor.background.setFill()
    rect.fill()
    drawMark(in: rect, includesTile: true)
}

let adaptiveIcon = withImage(width: 1024, height: 1024) { _ in
    drawMark(in: NSRect(x: 128, y: 128, width: 768, height: 768), includesTile: false)
}

let splash = withImage(width: 1242, height: 2436) { rect in
    BrandColor.background.setFill()
    rect.fill()
    fillCircle(center: CGPoint(x: rect.midX, y: 1400), diameter: 540, color: BrandColor.accent.withAlphaComponent(0.07))
    drawMark(in: NSRect(x: (rect.width - 260) / 2, y: 1320, width: 260, height: 260), includesTile: true)
    drawWordmark(y: 1128, width: rect.width, fontSize: 82)
    drawCenteredText("Your money, day by day.", y: 1064, width: rect.width, fontSize: 36, weight: .medium, color: BrandColor.muted)
}

try writePNG(icon, to: assets.appendingPathComponent("icon.png"))
try writePNG(adaptiveIcon, to: assets.appendingPathComponent("adaptive-icon.png"))
try writePNG(splash, to: assets.appendingPathComponent("splash.png"))

print("Generated assets/icon.png")
print("Generated assets/adaptive-icon.png")
print("Generated assets/splash.png")
