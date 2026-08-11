import SwiftUI

struct StatsView: View {
    @EnvironmentObject var app: AppViewModel

    private var totalCost: Double {
        app.sessions.reduce(0) { $0 + (($1).cost ?? 0) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 16) {
                    StatCard(label: "Sessions", value: "\(app.sessions.count)")
                    StatCard(label: "Total cost", value: String(format: "$%.2f", totalCost))
                    StatCard(label: "Models", value: "\(app.models.count)")
                    StatCard(label: "Providers", value: "\(app.providers.count)")
                    StatCard(label: "Agents", value: "\(app.agents.count)")
                }
                SectionCard(title: "Top sessions by cost") {
                    if app.sessions.isEmpty {
                        Text("No sessions yet.").foregroundStyle(.secondary)
                    } else {
                        ForEach(app.sessions.sorted { ($0.cost ?? 0) > ($1.cost ?? 0) }.prefix(10)) { s in
                            HStack {
                                Text(s.title).lineLimit(1)
                                Spacer()
                                Text(String(format: "$%.3f", s.cost ?? 0)).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                SectionCard(title: "Providers") {
                    if app.providers.isEmpty {
                        Text("Not loaded.").foregroundStyle(.secondary)
                    } else {
                        ForEach(app.providers) { p in
                            Text("\(p.name)  ·  \(p.id)").font(.caption)
                        }
                    }
                }
                SectionCard(title: "Agents") {
                    if app.agents.isEmpty {
                        Text("Not loaded.").foregroundStyle(.secondary)
                    } else {
                        ForEach(app.agents) { a in
                            Text(a.name).font(.caption)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Stats")
    }
}

struct StatCard: View {
    let label: String
    let value: String
    var body: some View {
        VStack(spacing: 4) {
            Text(value).font(.title.bold())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(minWidth: 90)
        .padding(12)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
    }
}
