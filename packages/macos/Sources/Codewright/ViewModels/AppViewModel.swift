import Foundation
import SwiftUI

@MainActor
final class AppViewModel: ObservableObject {
    @Published var config: AppConfig {
        didSet { saveConfig() }
    }
    @Published var connectionStatus: ConnectionStatus = .disconnected
    @Published var sessions: [Session] = []
    @Published var selectedSessionID: String?
    @Published var activeSession: SessionViewModel?
    @Published var models: [Model] = []
    @Published var providers: [Provider] = []
    @Published var agents: [Agent] = []
    @Published var errorMessage: String?

    let server = CodewrightServer()
    private(set) var client: APIClient?

    enum ConnectionStatus: Equatable {
        case disconnected, connecting, connected, error(String)
    }

    init() {
        self.config = AppViewModel.loadConfig()
        // restore api key from keychain
        if let key = Keychain.load(service: "codewright-apikey"), !key.isEmpty {
            self.config.apiKey = key
        }
    }

    // MARK: - Config persistence
    private static func loadConfig() -> AppConfig {
        guard let data = UserDefaults.standard.data(forKey: "codewright.config"),
              let cfg = try? JSONDecoder().decode(AppConfig.self, from: data) else {
            return AppConfig()
        }
        return cfg
    }
    private func saveConfig() {
        if let data = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(data, forKey: "codewright.config")
        }
        if config.apiKey.isEmpty {
            Keychain.delete(service: "codewright-apikey")
        } else {
            Keychain.save(config.apiKey, service: "codewright-apikey")
        }
    }

    // MARK: - Connection
    func connect() async {
        connectionStatus = .connecting
        errorMessage = nil
        if config.launchLocalServer {
            await server.launch(port: config.port)
        }
        client = APIClient(baseURL: config.baseURL)
        // wait for health
        for _ in 0..<40 {
            if await client?.health() == true {
                connectionStatus = .connected
                await refreshSessions()
                await loadConfigOptions()
                return
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        connectionStatus = .error("Cannot reach codewright server at \(config.baseURL.absoluteString)")
    }

    func disconnect() {
        server.stop()
        client = nil
        connectionStatus = .disconnected
        sessions = []
        activeSession = nil
    }

    // MARK: - Sessions
    func refreshSessions() async {
        guard let client else { return }
        do { sessions = try await client.listSessions() }
        catch { errorMessage = error.localizedDescription }
    }

    func newSession() async {
        guard let client else { return }
        do {
            let dir = config.defaultDirectory.isEmpty ? FileManager.default.homeDirectoryForCurrentUser.path : config.defaultDirectory
            let s = try await client.createSession(directory: dir,
                                                   agent: config.defaultAgent.isEmpty ? nil : config.defaultAgent,
                                                   model: config.defaultModel.isEmpty ? nil : config.defaultModel)
            sessions.insert(s, at: 0)
            await select(sessionID: s.id)
        } catch { errorMessage = error.localizedDescription }
    }

    func select(sessionID: String) async {
        guard let client else { return }
        selectedSessionID = sessionID
        let vm = SessionViewModel(sessionID: sessionID, client: client)
        await vm.loadHistory()
        activeSession = vm
    }

    // MARK: - Config options
    func loadConfigOptions() async {
        guard let client else { return }
        do {
            models = try await client.listModels()
            providers = try await client.listProviders()
            agents = try await client.listAgents()
        } catch { /* non-fatal */ }
    }
}
