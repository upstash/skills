use schemars::JsonSchema;
use serde::Deserialize;
use std::env;
use zed::settings::ContextServerSettings;
use zed_extension_api::{
    self as zed, serde_json, Command, ContextServerConfiguration, ContextServerId, Project, Result,
};

const PACKAGE_NAME: &str = "@upstash/mcp-server";
const SERVER_PATH: &str = "node_modules/@upstash/mcp-server/dist/index.js";
const SERVER_ID: &str = "mcp-server-upstash";

struct UpstashModelContextExtension;

#[derive(Debug, Deserialize, JsonSchema)]
struct UpstashContextServerSettings {
    /// The email address of your Upstash account.
    upstash_email: String,
    /// An API key from Upstash Console → Account → API Keys. Readonly keys work
    /// too; the server then disables every tool that would modify state.
    upstash_api_key: String,
    /// Optional. A Box API key, so the agent does not have to be handed one to
    /// use the Upstash Box tools.
    #[serde(default)]
    upstash_box_api_key: Option<String>,
}

impl zed::Extension for UpstashModelContextExtension {
    fn new() -> Self {
        Self
    }

    fn context_server_command(
        &mut self,
        _context_server_id: &ContextServerId,
        project: &Project,
    ) -> Result<Command> {
        let latest_version = zed::npm_package_latest_version(PACKAGE_NAME)?;
        let installed_version = zed::npm_package_installed_version(PACKAGE_NAME)?;
        if installed_version.as_deref() != Some(latest_version.as_ref()) {
            zed::npm_install_package(PACKAGE_NAME, &latest_version)?;
        }

        let settings = ContextServerSettings::for_project(SERVER_ID, project)?;
        let Some(settings) = settings.settings else {
            return Err("missing `upstash_email` and `upstash_api_key` settings".into());
        };
        let settings: UpstashContextServerSettings =
            serde_json::from_value(settings).map_err(|e| e.to_string())?;

        let server_path = env::current_dir()
            .map_err(|e| e.to_string())?
            .join(SERVER_PATH)
            .to_string_lossy()
            .to_string();

        // Credentials go through the environment rather than `--email` /
        // `--api-key` flags so they stay out of the process list.
        let mut env_vars = vec![
            ("UPSTASH_EMAIL".to_string(), settings.upstash_email),
            ("UPSTASH_API_KEY".to_string(), settings.upstash_api_key),
        ];
        if let Some(box_api_key) = settings.upstash_box_api_key {
            env_vars.push(("UPSTASH_BOX_API_KEY".to_string(), box_api_key));
        }

        Ok(Command {
            command: zed::node_binary_path()?,
            args: vec![server_path],
            env: env_vars,
        })
    }

    fn context_server_configuration(
        &mut self,
        _context_server_id: &ContextServerId,
        _project: &Project,
    ) -> Result<Option<ContextServerConfiguration>> {
        let installation_instructions =
            include_str!("../configuration/installation_instructions.md").to_string();
        let default_settings = include_str!("../configuration/default_settings.jsonc").to_string();
        let settings_schema =
            serde_json::to_string(&schemars::schema_for!(UpstashContextServerSettings))
                .map_err(|e| e.to_string())?;

        Ok(Some(ContextServerConfiguration {
            installation_instructions,
            default_settings,
            settings_schema,
        }))
    }
}

zed::register_extension!(UpstashModelContextExtension);
