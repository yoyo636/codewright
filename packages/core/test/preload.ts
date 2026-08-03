import path from "path"

process.env.CODEWRIGHT_DB = ":memory:"
process.env.CODEWRIGHT_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.CODEWRIGHT_DISABLE_MODELS_FETCH = "true"
