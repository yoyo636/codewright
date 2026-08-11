import SwiftUI
import AppKit

func attributedMarkdown(_ s: String) -> AttributedString {
    (try? AttributedString(markdown: s,
        options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
}

func prettyJSON(_ raw: String) -> String? {
    guard let data = raw.data(using: .utf8),
          let obj = try? JSONSerialization.jsonObject(with: data),
          let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
          let str = String(data: pretty, encoding: .utf8) else { return nil }
    return str
}

struct MessageBubble: View {
    let m: Message
    var body: some View {
        HStack {
            if m.isUser { Spacer(minLength: 40) }
            VStack(alignment: m.isUser ? .trailing : .leading, spacing: 6) {
                ForEach(m.parts ?? [], id: \.stableID) { part in
                    PartView(part: part)
                }
            }
            .padding(12)
            .background(
                m.isUser
                    ? Color.accentColor.opacity(0.18)
                    : Color(NSColor.textBackgroundColor).opacity(0.7)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.secondary.opacity(0.12), lineWidth: 1)
            )
            if !m.isUser { Spacer(minLength: 40) }
        }
    }
}

struct PartView: View {
    let part: MessagePart
    var body: some View {
        switch part.type {
        case "text":
            if let t = part.text {
                Text(attributedMarkdown(t))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case "tool", "function":
            ToolPartView(tool: part.tool)
        default:
            if let t = part.text, !t.isEmpty {
                Text(t).textSelection(.enabled)
            }
        }
    }
}

struct ToolPartView: View {
    let tool: ToolCall?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "wrench.and.screwdriver.fill").foregroundStyle(.tint)
                Text(tool?.name ?? "tool").font(.caption.bold())
                if let s = tool?.state {
                    Text(s).font(.caption2).foregroundStyle(.secondary)
                }
                if let o = tool?.output, !o.isEmpty {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.caption)
                }
            }
            if let i = tool?.input, let d = prettyJSON(i) {
                Text(d)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .lineLimit(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(8)
        .background(.quaternary)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
