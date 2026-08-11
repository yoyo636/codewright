// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "Codewright",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "Codewright",
            path: "Sources/Codewright",
            exclude: ["Info.plist"]
        )
    ]
)
