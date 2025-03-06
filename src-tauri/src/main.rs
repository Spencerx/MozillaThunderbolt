// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod embedding;
mod imap_client;

use anyhow::Result;
use sea_orm::ActiveModelTrait;
use std::env;
use tauri::{command, ActivationPolicy};

use entity::extensions::{MessageExt, SettingExt};
use entity::{message::Model as Message, *};

#[command]
fn get_openai_api_key() -> String {
    println!(
        "get_openai_api_key {}",
        env::var("OPENAI_API_KEY").unwrap_or_default()
    );

    if let Ok(path) = env::var("CARGO_MANIFEST_DIR") {
        let env_path = std::path::Path::new(&path).join(".env");
        if env_path.exists() {
            dotenv::from_path(env_path).ok();
        }
    }

    let open_ai_api_key =
        env::var("OPENAI_API_KEY").expect("OPENAI_API_KEY environment variable must be set");

    open_ai_api_key
}

#[command]
async fn get_setting(id: String) -> Result<Option<setting::Model>, String> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

    let db = db::get_connection().await.map_err(|e| e.to_string())?;

    setting::Entity::find()
        .filter(setting::Column::Id.eq(id))
        .one(&db)
        .await
        .map_err(|e| e.to_string())
}

#[command]
async fn set_setting(id: String, value: String) -> Result<setting::Model, String> {
    use chrono::Utc;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    let db = db::get_connection().await.map_err(|e| e.to_string())?;

    // Check if setting exists
    let setting_exists = setting::Entity::find()
        .filter(setting::Column::Id.eq(&id))
        .one(&db)
        .await
        .map_err(|e| e.to_string())?
        .is_some();

    let active_model = if setting_exists {
        // Update existing setting using the extension trait
        let existing = setting::Entity::find()
            .filter(setting::Column::Id.eq(&id))
            .one(&db)
            .await
            .map_err(|e| e.to_string())?
            .unwrap();

        let mut active_model = existing.into_active_model();
        active_model.value = Set(value);
        active_model.updated_at = Set(Utc::now());
        active_model
    } else {
        // Create new setting
        setting::ActiveModel {
            id: Set(id),
            value: Set(value),
            updated_at: Set(Utc::now()),
            ..Default::default()
        }
    };

    // Save to database
    if setting_exists {
        active_model.update(&db).await.map_err(|e| e.to_string())
    } else {
        active_model.insert(&db).await.map_err(|e| e.to_string())
    }
}

#[command]
async fn toggle_dock_icon(app_handle: tauri::AppHandle, show: bool) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let policy = if show {
            ActivationPolicy::Regular
        } else {
            ActivationPolicy::Accessory
        };

        let _ = app_handle.set_activation_policy(policy);
    }

    Ok(())
}

#[command]
async fn fetch_inbox_top(count: Option<usize>) -> Result<Vec<Message>, String> {
    println!("fetch_inbox_top {:?}", count);
    imap_client::fetch_inbox_top(Some(3)).map_err(|e| e.to_string())
}

#[command]
async fn get_or_create_stronghold_password(
    service_name: String,
    username: String,
) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        // In debug mode, always return "password"
        return Ok("password".to_string());
    }

    // In release mode, use the keyring
    #[cfg(not(debug_assertions))]
    {
        // Try to load existing password from system keyring
        match Entry::new(&service_name, &username) {
            Ok(entry) => match entry.get_password() {
                Ok(password) => Ok(password),
                Err(_) => {
                    // Password doesn't exist yet, prompt user
                    // In a real app, you would show a UI here
                    // Generate a truly random password using UUID
                    let new_password = uuid::Uuid::new_v4().to_string();

                    // Store the new password in the keyring
                    entry
                        .set_password(&new_password)
                        .map_err(|e| e.to_string())?;
                    Ok(new_password.to_string())
                }
            },
            Err(e) => Err(format!("Failed to create keyring entry: {}", e)),
        }
    }
}

#[command]
async fn process_message(message: message::Model) -> Result<(), String> {
    let db = db::get_connection().await.map_err(|e| e.to_string())?;

    // Use the extension trait method
    let active_model = message.into_active_model();

    // Now you can save it
    active_model.save(&db).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // This should be called as early in the execution of the app as possible
    #[cfg(debug_assertions)] // only enable instrumentation in development builds
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_openai_api_key,
            toggle_dock_icon, // Add the new command
            fetch_inbox_top,
            get_or_create_stronghold_password,
            process_message,
            get_setting,
            set_setting,
        ]);

    // Set the activation policy to accessory on macOS to prevent the app from being shown in the dock
    // if cfg!(target_os = "macos") {
    //     builder = builder.setup(|app| {
    //         let _ = app
    //             .handle()
    //             .set_activation_policy(ActivationPolicy::Accessory);
    //         Ok(())
    //     });
    // }

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Handle the Result and Option types
    let messages = imap_client::fetch_inbox_top(Some(3)).unwrap();
    let message = messages.first().unwrap();

    let db = db::init_db().await?;

    // let message = message::ActiveModel {
    //     id: Set(1),
    //     date: Set(chrono::Utc::now()),
    //     subject: Set("Test Subject".to_owned()),
    //     body: Set("This is the message body".to_owned()),
    //     snippet: Set("This is the snippet".to_owned()),
    //     clean_text: Set("This is the clean text".to_owned()),
    //     clean_text_tokens_in: Set(0),
    //     clean_text_tokens_out: Set(0),
    // };

    let _: message::Model = message.clone().into_active_model().insert(&db).await?;

    let embedding = embedding::get_embedding("Hello, world!")?;
    println!("{:?}", embedding);

    mozilla_assist_lib::run();

    Ok(())
}
