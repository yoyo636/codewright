import SwiftUI

/// Inline banner surfacing pending permission (approval) requests.
/// Ties directly into the safety/approval layer exposed by `codewright serve`.
struct PermissionBanner: View {
    @EnvironmentObject var app: AppViewModel

    var body: some View {
        if let vm = app.activeSession, !vm.permissionRequests.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Label("Approval required", systemImage: "hand.raised.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
                ForEach(vm.permissionRequests) { req in
                    PermissionRow(req: req)
                }
            }
            .padding(12)
            .background(.orange.opacity(0.10))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal, 12)
        }
    }
}

struct PermissionRow: View {
    @EnvironmentObject var app: AppViewModel
    let req: PermissionRequest
    @State private var always = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(req.summary).font(.caption.bold())
                if !req.patterns.isEmpty {
                    Text(req.patterns.joined(separator: "   "))
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
            Spacer()
            Toggle("Always", isOn: $always).toggleStyle(.switch).scaleEffect(0.8)
            Button("Deny") { Task { await app.activeSession?.replyPermission(req, decision: "deny", always: always) } }
                .keyboardShortcut(.escape)
                .controlSize(.small)
            Button("Allow") {
                Task { await app.activeSession?.replyPermission(req, decision: "allow", always: always) }
            }
            .keyboardShortcut(.return)
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(10)
        .background(.thickMaterial, in: RoundedRectangle(cornerRadius: 10))
    }
}
