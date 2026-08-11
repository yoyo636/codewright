import SwiftUI

struct ContentView: View {
    @EnvironmentObject var app: AppViewModel
    @State private var showFiles = false
    @State private var showStats = false
    @State private var showSettings = false

    var body: some View {
        NavigationSplitView {
            SessionSidebar()
                .environmentObject(app)
                .navigationSplitViewColumnWidth(min: 240, ideal: 280, max: 360)
        } content: {
            ChatView()
                .environmentObject(app)
        } detail: {
            if showStats {
                StatsView().environmentObject(app)
            } else if showFiles {
                FileBrowserView().environmentObject(app)
            } else {
                PlaceholderDetail()
            }
        }
        .navigationSplitViewStyle(.balanced)
        .toolbar {
            ToolbarItem {
                Button(action: { Task { await app.newSession() } }) {
                    Label("New Chat", systemImage: "square.and.pencil")
                }
                .help("New chat (⌘N)")
            }
            ToolbarItem {
                Button(action: { showFiles.toggle(); showStats = false }) {
                    Label("Files", systemImage: "folder")
                }
                .help("Toggle file browser")
            }
            ToolbarItem {
                Button(action: { showStats.toggle(); showFiles = false }) {
                    Label("Stats", systemImage: "chart.bar")
                }
                .help("Toggle stats")
            }
            ToolbarItem {
                Button(action: { Task { await app.refreshSessions() } }) {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .help("Refresh sessions")
            }
            ToolbarItem {
                Button {
                    showSettings = true
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                .help("Settings")
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView().environmentObject(app)
                .frame(minWidth: 520, minHeight: 560)
        }
        .overlay {
            if case .error(let msg) = app.connectionStatus {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle").font(.largeTitle)
                    Text("Connection error").font(.headline)
                    Text(msg).font(.caption).foregroundStyle(.secondary)
                    Button("Retry") { Task { await app.connect() } }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.ultraThickMaterial)
            }
        }
    }
}

struct PlaceholderDetail: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles").font(.system(size: 40)).foregroundStyle(.tint)
            Text("Codewright").font(.title.bold())
            Text("Select a chat or start a new one.").foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .toolbar { }
    }
}
