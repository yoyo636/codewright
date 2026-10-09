# typed: strict
# frozen_string_literal: true

# Homebrew formula for codewright - AI coding agent (terminal edition)
#
# Install:
#   brew tap yoyo636/codewright https://github.com/yoyo636/codewright.git
#   brew install codewright
#
# Or from a local checkout:
#   brew install --build-from-source Formula/codewright.rb
#
# Dependencies:
#   - ripgrep (rg) - required for code search (recommended)

class Codewright < Formula
  desc "AI coding agent for the terminal"
  homepage "https://github.com/yoyo636/codewright"
  license "MIT"
  version "3.0.5-beta"

  # SHA256 digests are taken from the GitHub release assets for this version.
  # To update them for a new release, run:
  #   shasum -a 256 <archive.zip|archive.tar.gz>

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-x64.zip"
      sha256 "7888f5a504dd695bd2e32b100bb8416b03fd9920039741fa34a0b825b68076c9"
    end

    if Hardware::CPU.arm?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-darwin-arm64.zip"
      sha256 "e3c0c68c7d673d294b649c5ff22689884ee702124f2977aca378af52bc73ab5e"
    end
  end

  on_linux do
    if Hardware::CPU.intel? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-x64.tar.gz"
      sha256 "6fb6cb4bc8d8bf25ff0874d735c32b1dbeae1b2637b10b125b11aa91f7523642"
    end

    if Hardware::CPU.arm? && Hardware::CPU.is_64_bit?
      url "https://github.com/yoyo636/codewright/releases/download/v#{version}/codewright-linux-arm64.tar.gz"
      sha256 "8da834d1a6cfa6f3479bd1abe0dd2d1751db936ad5ea067a34d505371bd9a147"
    end
  end

  depends_on "ripgrep" => :recommended

  def install
    bin.install "codewright"

    # Generate shell completions
    generate_completions_from_executable(bin/"codewright", "completion")
  end

  test do
    assert_match "codewright", shell_output("#{bin}/codewright --version")
  end
end