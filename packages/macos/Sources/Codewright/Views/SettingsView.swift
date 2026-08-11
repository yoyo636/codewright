import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject var app: AppViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var draft: AppConfig = .init()
    @State private var showDirPicker = false
    @State private var showLogs = false

    var body: some View {
        VStack(spacing: 0) {
            Form {
                Section("Connection") {
                    Toggle("Launch local server on start", isOn: $draft.launchLocalServer)
                    HStack {
                        Text("Host"); Spacer()
                        TextField("host", text: $draft.host).frame(width: 160)
                    }
                    HStack {
                        Text("Port"); Spacer()
                        TextField("port", value: $draft.port, format: .number).frame(width: 160)
                    }
                }
                Section("Project") {
                    HStack {
                        Text("Working directory")
                        Spacer()
                        TextField("path", text: $draft.defaultDirectory).frame(width: 240)
                        Button("Choose…") { showDirPicker = true }
                    }
                }
                Section("Defaults") {
                    agentPicker
                    modelPicker
                    Picker("Approval mode", selection: $draft.approvalMode) {
                        ForEach(AppConfig.ApprovalMode.allCases, id: \.self) { m in
                            Text(m.label).tag(m)
                        }
                    }
                }
                Section("Provider API key") {
                    SecureField("Optional (stored in Keychain)", text: $draft.apiKey)
                        .textFieldStyle(.roundedBorder)
                    Text("Used by the agent's LLM provider, not to reach the local server.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            .formStyle(.grouped)
            .scrollContentBackground(.hidden)
            .padding()

            Divider()
            HStack {
                Button { showLogs.toggle() } label: { Label("Server log", systemImage: "terminal") }
                Spacer()
                if case .connected = app.connectionStatus {
                    Button("Disconnect") { app.disconnect() }
                } else {
                    Button("Connect") { Task { await app.connect() } }
                }
                Button("Done") {
                    app.config = draft
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .frame(minWidth: 540, minHeight: 560)
        .navigationTitle("Settings")
        .onAppear { draft = app.config }
        .fileImporter(isPresented: $showDirPicker, allowedContentTypes: [.folder], allowsMultipleSelection: false) { res in
            if case .success(let urls) = res, let u = urls.first {
                draft.defaultDirectory = u.path
            }
        }
        if showLogs {
            LogPanel().environmentObject(app).frame(height: 160)
        }
    }

    @ViewBuilder
    private var agentPicker: some View {
        if app.agents.isEmpty {
            HStack {
                Text("Default agent"); Spacer()
                TextField("agent", text: $draft.defaultAgent).frame(width: 200)
            }
        } else {
            Picker("Default agent", selection: $draft.defaultAgent) {
                Text("Default").tag("")
                ForEach(app.agents, id: \.name) { a in
                    Text(a.name).tag(a.name)
                }
            }
        }
    }

    @ViewBuilder
    private var modelPicker: some View {
        if app.models.isEmpty {
            HStack {
                Text("Default model"); Spacer()
                TextField("model", text: $draft.defaultModel).frame(width: 200)
            }
        } else {
            Picker("Default model", selection: $draft.defaultModel) {
                Text("Default").tag("")
                ForEach(app.models, id: \.id) { m in
                    Text("\(m.name)  ·  \(m.providerID)").tag(m.id)
                }
            }
        }
    }
}

struct LogPanel: View {
    @EnvironmentObject var app: AppViewModel
    var body: some View {
        ScrollView {
            Text(app.server.logLines.joined(separator: "\n"))
                .font(.system(.caption, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
        }
        .background(.black.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal)
    }
}
