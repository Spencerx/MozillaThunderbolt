use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Setting::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Setting::Id)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(text(Setting::Value))
                    .col(timestamp(Setting::UpdatedAt))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Setting::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Setting {
    Table,
    Id,
    Value,
    UpdatedAt,
}
