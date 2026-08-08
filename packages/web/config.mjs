const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://codewright.dev" : `https://${stage}.codewright.dev`,
  console: stage === "production" ? "https://codewright.dev/auth" : `https://${stage}.codewright.dev/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/yoyo636/codewright",
  discord: "https://codewright.dev/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
