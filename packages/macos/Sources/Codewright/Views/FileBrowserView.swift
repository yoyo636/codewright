import SwiftUI

struct FileBrowserView: View {
    @EnvironmentObject var app: AppViewModel
    @State private var path = "/"
    @State private var nodes: [FSNode] = []
    @State private var content: String?
    @State private var selection: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Button { goUp() } label: { Image(systemName: "arrow.up") }.help("Up")
                Text(path).font(.caption.monospaced()).foregroundStyle(.secondary).lineLimit(1)
                Spacer()
                if selection != nil {
                    Button("Close") { content = nil; selection = nil }
                }
            }
            .padding(8)
            Divider()
            HStack(spacing: 0) {
                List(nodes) { node in
                    HStack(spacing: 6) {
                        Image(systemName: node.isDirectory ? "folder" : "doc.text")
                        Text(node.name).lineLimit(1)
                        Spacer()
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { Task { await open(node) } }
                }
                .frame(width: 230)
                Divider()
                ScrollView {
                    if let c = content {
                        Text(c)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                    } else {
                        Text("Select a file to preview.").foregroundStyle(.secondary).padding()
                    }
                }
            }
        }
        .navigationTitle("Files")
        .task { await load(path) }
    }

    private func load(_ p: String) async {
        guard let client = app.client else { return }
        do { nodes = try await client.fs.list(path: p) } catch { nodes = [] }
    }

    private func open(_ node: FSNode) async {
        let full = (path as NSString).appendingPathComponent(node.name)
        if node.isDirectory {
            path = full; selection = nil; content = nil; await load(full)
        } else {
            selection = full
            if let client = app.client { content = try? await client.fs.read(path: full) }
        }
    }

    private func goUp() {
        let parent = (path as NSString).deletingLastPathComponent
        if parent != path { path = parent; Task { await load(parent) } }
    }
}
