/// SQLite-backed historical metrics storage — Feature 3.
///
/// Schema: a single `metric_samples` table storing per-sample aggregate values.
/// Retention: 7 days (604800 seconds). Samples are inserted every 5 seconds.
///
/// Migration strategy: on open, CREATE TABLE IF NOT EXISTS — no external
/// migration tool required for this simple single-table schema.
use std::path::Path;
use parking_lot::Mutex;
use rusqlite::{params, Connection, Result as SqlResult};

pub struct MetricsDb {
    conn: Mutex<Connection>,
}

impl MetricsDb {
    /// Open (or create) the metrics database at the given path.
    pub fn open(path: &Path) -> SqlResult<Self> {
        let conn = Connection::open(path)?;

        // Performance tuning: WAL mode + relaxed sync for time-series append workload
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA cache_size = -2000;
        ")?;

        // Create table if it doesn't exist (idempotent migration)
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS metric_samples (
                ts_ms      INTEGER NOT NULL,
                cpu        REAL    NOT NULL DEFAULT 0,
                mem_used   INTEGER NOT NULL DEFAULT 0,
                mem_total  INTEGER NOT NULL DEFAULT 0,
                disk_rw    INTEGER NOT NULL DEFAULT 0,
                net_rxtx   INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_ts ON metric_samples (ts_ms);
        ")?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Insert a new sample and prune records older than 7 days.
    pub fn insert_sample(
        &self,
        ts_ms: i64,
        cpu: f32,
        mem_used: u64,
        mem_total: u64,
        disk_rw: u64,
        net_rxtx: u64,
    ) -> SqlResult<()> {
        const RETENTION_MS: i64 = 7 * 24 * 3600 * 1000; // 7 days in milliseconds

        let conn = self.conn.lock();
        conn.execute(
            "INSERT INTO metric_samples (ts_ms, cpu, mem_used, mem_total, disk_rw, net_rxtx)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![ts_ms, cpu as f64, mem_used as i64, mem_total as i64, disk_rw as i64, net_rxtx as i64],
        )?;

        // Prune old data
        let cutoff = ts_ms - RETENTION_MS;
        conn.execute(
            "DELETE FROM metric_samples WHERE ts_ms < ?1",
            params![cutoff],
        )?;

        Ok(())
    }

    /// Query samples in a time window, returning at most `max_points` evenly
    /// sampled rows (downsampling for chart performance).
    pub fn query_range(
        &self,
        from_ms: i64,
        to_ms: i64,
        max_points: usize,
    ) -> SqlResult<Vec<DbSample>> {
        let conn = self.conn.lock();

        // Count total rows in range first
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM metric_samples WHERE ts_ms BETWEEN ?1 AND ?2",
            params![from_ms, to_ms],
            |r| r.get(0),
        )?;

        let stride = if count as usize > max_points {
            (count as usize + max_points - 1) / max_points
        } else {
            1
        };

        let mut stmt = conn.prepare(
            "SELECT ts_ms, cpu, mem_used, mem_total, disk_rw, net_rxtx
             FROM metric_samples
             WHERE ts_ms BETWEEN ?1 AND ?2
             ORDER BY ts_ms ASC",
        )?;

        let rows = stmt.query_map(params![from_ms, to_ms], |r| {
            Ok(DbSample {
                ts_ms: r.get(0)?,
                cpu: r.get::<_, f64>(1)? as f32,
                mem_used: r.get::<_, i64>(2)? as u64,
                mem_total: r.get::<_, i64>(3)? as u64,
                disk_rw: r.get::<_, i64>(4)? as u64,
                net_rxtx: r.get::<_, i64>(5)? as u64,
            })
        })?;

        let mut result = Vec::new();
        for (i, row) in rows.enumerate() {
            if i % stride == 0 {
                result.push(row?);
            }
        }
        Ok(result)
    }
}

#[derive(Debug, Clone)]
pub struct DbSample {
    pub ts_ms: i64,
    pub cpu: f32,
    pub mem_used: u64,
    pub mem_total: u64,
    pub disk_rw: u64,
    pub net_rxtx: u64,
}
