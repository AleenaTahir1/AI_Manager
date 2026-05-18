use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ProcessExplainInput {
    pub name: String,
    pub exe: Option<String>,
    pub cmd: Option<String>,
    pub parent_name: Option<String>,
    pub mem_bytes: u64,
    pub cpu: f32,
    pub threat: String,
}

#[derive(Debug, Deserialize)]
pub struct SystemExplainInput {
    pub cpu_total: f32,
    pub mem_used: u64,
    pub mem_total: u64,
    pub top_processes: Vec<TopProcessSummary>,
}

#[derive(Debug, Deserialize)]
pub struct TopProcessSummary {
    pub name: String,
    pub cpu: f32,
    pub mem_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct AiReply {
    pub answer: String,
    pub cached: bool,
}

#[derive(Debug, Deserialize)]
pub struct AiConfig {
    pub api_key: String,
    pub model: Option<String>,
    pub base_url: Option<String>,
}

fn cache_key(scope: &str, payload: &str) -> String {
    let mut h = Sha256::new();
    h.update(scope.as_bytes());
    h.update([0]);
    h.update(payload.as_bytes());
    hex::encode(h.finalize())
}

async fn openrouter_chat(
    config: &AiConfig,
    system_prompt: &str,
    user_prompt: &str,
) -> Result<String, String> {
    let base = config
        .base_url
        .clone()
        .unwrap_or_else(|| "https://openrouter.ai/api/v1".to_string());
    let model = config
        .model
        .clone()
        .unwrap_or_else(|| "google/gemini-2.0-flash-001".to_string());

    let body = serde_json::json!({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 600,
        "temperature": 0.3,
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("client: {e}"))?;

    let resp = client
        .post(format!("{}/chat/completions", base.trim_end_matches('/')))
        .bearer_auth(&config.api_key)
        .header("HTTP-Referer", "https://github.com/Razee4315/AI_Manager")
        .header("X-Title", "AI Task Manager")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("send: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("LLM error {status}: {text}"));
    }
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("parse: {e}"))?;
    let answer = json
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();
    if answer.is_empty() {
        return Err("empty response from LLM".to_string());
    }
    Ok(answer)
}

#[tauri::command]
pub async fn explain_process(
    state: State<'_, Arc<AppState>>,
    config: AiConfig,
    input: ProcessExplainInput,
) -> Result<AiReply, String> {
    let payload = serde_json::to_string(&serde_json::json!({
        "name": input.name,
        "exe": input.exe,
        "cmd": input.cmd,
        "parent_name": input.parent_name,
    }))
    .unwrap_or_default();
    let key = cache_key("process", &payload);

    if let Some(cached) = state.ai_cache.read().get(&key).cloned() {
        return Ok(AiReply {
            answer: cached,
            cached: true,
        });
    }

    let system_prompt = "You are a Windows internals expert advising a power user. \
Be concise: 4-7 short sentences. \
Explain what the process is, who ships it, what it usually does, and whether ending it is safe. \
If signals suggest malware, say so explicitly and recommend an antivirus scan. Use plain language, no marketing fluff.";

    let user_prompt = format!(
        "Process: {}\nExecutable: {}\nCommand line: {}\nParent process: {}\nMemory: {:.1} MB\nCPU: {:.1}%\nRule-based threat tier: {}",
        input.name,
        input.exe.unwrap_or_else(|| "(unknown)".into()),
        input.cmd.unwrap_or_else(|| "(unknown)".into()),
        input.parent_name.unwrap_or_else(|| "(unknown)".into()),
        input.mem_bytes as f64 / 1024.0 / 1024.0,
        input.cpu,
        input.threat,
    );

    let answer = openrouter_chat(&config, system_prompt, &user_prompt).await?;
    state.ai_cache.write().insert(key, answer.clone());
    Ok(AiReply {
        answer,
        cached: false,
    })
}

#[tauri::command]
pub async fn explain_system(
    _state: State<'_, Arc<AppState>>,
    config: AiConfig,
    input: SystemExplainInput,
) -> Result<AiReply, String> {
    let top_list = input
        .top_processes
        .iter()
        .take(8)
        .map(|p| {
            format!(
                "- {} — CPU {:.1}%, RAM {:.0} MB",
                p.name,
                p.cpu,
                p.mem_bytes as f64 / 1024.0 / 1024.0
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let system_prompt = "You are a Windows performance analyst. \
Given the snapshot below, return prioritised, concrete recommendations: top 3 likely culprits and what the user could do (close, restart, investigate). \
Be direct, no preamble. Use short bullet points. Never invent processes that are not in the list.";

    let user_prompt = format!(
        "CPU total: {:.1}%\nRAM used: {:.1} / {:.1} GB\nTop processes:\n{}",
        input.cpu_total,
        input.mem_used as f64 / 1024.0 / 1024.0 / 1024.0,
        input.mem_total as f64 / 1024.0 / 1024.0 / 1024.0,
        top_list,
    );

    let answer = openrouter_chat(&config, system_prompt, &user_prompt).await?;
    Ok(AiReply {
        answer,
        cached: false,
    })
}
