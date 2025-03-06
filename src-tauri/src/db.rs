use migration::{Migrator, MigratorTrait};
use once_cell::sync::OnceCell;
use sea_orm::*;

static DB_CONN: OnceCell<DatabaseConnection> = OnceCell::new();

pub async fn init_db() -> Result<DatabaseConnection, DbErr> {
    let conn: DatabaseConnection = Database::connect("sqlite://data/local.db?mode=rwc")
        .await
        .unwrap();

    Migrator::up(&conn, None).await.unwrap();

    // Store the connection in the global OnceCell
    let _ = DB_CONN.set(conn.clone());

    Ok(conn)
}

pub async fn get_connection() -> Result<DatabaseConnection, DbErr> {
    match DB_CONN.get() {
        Some(conn) => Ok(conn.clone()),
        None => {
            // Initialize on first use if not already done
            let conn = init_db().await?;
            match DB_CONN.get() {
                Some(conn) => Ok(conn.clone()),
                None => Err(DbErr::Custom("Failed to initialize database".to_string())),
            }
        }
    }
}
