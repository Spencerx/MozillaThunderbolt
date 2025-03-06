use sea_orm::Set;

use crate::message;
use crate::setting;

/// Extension trait for message::Model to add custom functionality
pub trait MessageExt {
    fn into_active_model(self) -> message::ActiveModel;
}

impl MessageExt for message::Model {
    fn into_active_model(self) -> message::ActiveModel {
        message::ActiveModel {
            id: Set(self.id),
            date: Set(self.date),
            subject: Set(self.subject),
            body: Set(self.body),
            snippet: Set(self.snippet),
            clean_text: Set(self.clean_text),
            clean_text_tokens_in: Set(self.clean_text_tokens_in),
            clean_text_tokens_out: Set(self.clean_text_tokens_out),
        }
    }
}

/// Extension trait for setting::Model to add custom functionality
pub trait SettingExt {
    fn into_active_model(self) -> setting::ActiveModel;
}

impl SettingExt for setting::Model {
    fn into_active_model(self) -> setting::ActiveModel {
        setting::ActiveModel {
            id: Set(self.id),
            value: Set(self.value),
            updated_at: Set(self.updated_at),
        }
    }
}
