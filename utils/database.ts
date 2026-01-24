/**
 * SQLite Database Utility
 *
 * Handles local storage of driver statistics per authenticated user.
 * Data persists until app is uninstalled.
 *
 * Features:
 * - User-specific stats storage
 * - Daily stats tracking
 * - Historical data preservation
 * - Automatic database initialization
 */

import * as SQLite from "expo-sqlite";

const DB_NAME = "driver_stats.db";

/**
 * Database Schema:
 *
 * user_stats:
 * - id: INTEGER PRIMARY KEY
 * - user_id: TEXT (Clerk user ID)
 * - date: TEXT (YYYY-MM-DD format)
 * - km_driven: REAL
 * - stops_done: INTEGER
 * - stops_delivered: INTEGER
 * - stops_not_handled: INTEGER
 * - time_spent: INTEGER (minutes)
 * - created_at: TEXT
 * - updated_at: TEXT
 */

export interface UserStatsRecord {
  id?: number;
  user_id: string;
  date: string;
  km_driven: number;
  stops_done: number;
  stops_delivered: number;
  stops_not_handled: number;
  time_spent: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Initialize database and create tables if they don't exist
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      km_driven REAL DEFAULT 0,
      stops_done INTEGER DEFAULT 0,
      stops_delivered INTEGER DEFAULT 0,
      stops_not_handled INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date)
    );
    
    CREATE INDEX IF NOT EXISTS idx_user_date ON user_stats(user_id, date);
  `);

  console.log("✅ Database initialized successfully");
  return db;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Get today's stats for a specific user
 */
export async function getTodayStats(
  userId: string
): Promise<UserStatsRecord | null> {
  const db = await initDatabase();
  const today = getTodayDate();

  try {
    const result = await db.getFirstAsync<UserStatsRecord>(
      "SELECT * FROM user_stats WHERE user_id = ? AND date = ?",
      [userId, today]
    );

    return result || null;
  } catch (error) {
    console.error("Error fetching today stats:", error);
    return null;
  }
}

/**
 * Save or update today's stats for a user
 */
export async function saveTodayStats(
  userId: string,
  stats: Omit<
    UserStatsRecord,
    "id" | "user_id" | "date" | "created_at" | "updated_at"
  >
): Promise<void> {
  const db = await initDatabase();
  const today = getTodayDate();

  try {
    await db.runAsync(
      `INSERT INTO user_stats (user_id, date, km_driven, stops_done, stops_delivered, stops_not_handled, time_spent, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id, date) 
       DO UPDATE SET 
         km_driven = excluded.km_driven,
         stops_done = excluded.stops_done,
         stops_delivered = excluded.stops_delivered,
         stops_not_handled = excluded.stops_not_handled,
         time_spent = excluded.time_spent,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        today,
        stats.km_driven,
        stats.stops_done,
        stats.stops_delivered,
        stats.stops_not_handled,
        stats.time_spent,
      ]
    );

    console.log("✅ Stats saved successfully for user:", userId);
  } catch (error) {
    console.error("Error saving stats:", error);
    throw error;
  }
}

/**
 * Increment specific stat values for today
 */
export async function incrementStats(
  userId: string,
  updates: {
    km_driven?: number;
    stops_done?: number;
    stops_delivered?: number;
    stops_not_handled?: number;
    time_spent?: number;
  }
): Promise<void> {
  const db = await initDatabase();
  const today = getTodayDate();

  try {
    // First ensure a record exists for today
    await db.runAsync(
      `INSERT OR IGNORE INTO user_stats (user_id, date) VALUES (?, ?)`,
      [userId, today]
    );

    // Build dynamic update query
    const updateParts: string[] = [];
    const values: (number | string)[] = [];

    if (updates.km_driven !== undefined) {
      updateParts.push("km_driven = km_driven + ?");
      values.push(updates.km_driven);
    }
    if (updates.stops_done !== undefined) {
      updateParts.push("stops_done = stops_done + ?");
      values.push(updates.stops_done);
    }
    if (updates.stops_delivered !== undefined) {
      updateParts.push("stops_delivered = stops_delivered + ?");
      values.push(updates.stops_delivered);
    }
    if (updates.stops_not_handled !== undefined) {
      updateParts.push("stops_not_handled = stops_not_handled + ?");
      values.push(updates.stops_not_handled);
    }
    if (updates.time_spent !== undefined) {
      updateParts.push("time_spent = time_spent + ?");
      values.push(updates.time_spent);
    }

    if (updateParts.length > 0) {
      values.push(userId, today);
      await db.runAsync(
        `UPDATE user_stats SET ${updateParts.join(
          ", "
        )}, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND date = ?`,
        values
      );
    }

    console.log("✅ Stats incremented for user:", userId);
  } catch (error) {
    console.error("Error incrementing stats:", error);
    throw error;
  }
}

/**
 * Get historical stats for a user (last N days)
 */
export async function getHistoricalStats(
  userId: string,
  days: number = 7
): Promise<UserStatsRecord[]> {
  const db = await initDatabase();

  try {
    const result = await db.getAllAsync<UserStatsRecord>(
      `SELECT * FROM user_stats 
       WHERE user_id = ? 
       ORDER BY date DESC 
       LIMIT ?`,
      [userId, days]
    );

    return result || [];
  } catch (error) {
    console.error("Error fetching historical stats:", error);
    return [];
  }
}

/**
 * Get stats for a custom date range
 */
export async function getStatsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<UserStatsRecord[]> {
  const db = await initDatabase();

  try {
    const result = await db.getAllAsync<UserStatsRecord>(
      `SELECT * FROM user_stats 
       WHERE user_id = ? AND date >= ? AND date <= ?
       ORDER BY date DESC`,
      [userId, startDate, endDate]
    );

    return result || [];
  } catch (error) {
    console.error("Error fetching stats by date range:", error);
    return [];
  }
}

/**
 * Get total stats for a user (all time)
 */
export async function getTotalStats(userId: string): Promise<{
  total_km: number;
  total_stops: number;
  total_delivered: number;
  total_not_handled: number;
  total_time: number;
  days_active: number;
}> {
  const db = await initDatabase();

  try {
    const result = await db.getFirstAsync<any>(
      `SELECT 
         COALESCE(SUM(km_driven), 0) as total_km,
         COALESCE(SUM(stops_done), 0) as total_stops,
         COALESCE(SUM(stops_delivered), 0) as total_delivered,
         COALESCE(SUM(stops_not_handled), 0) as total_not_handled,
         COALESCE(SUM(time_spent), 0) as total_time,
         COUNT(DISTINCT date) as days_active
       FROM user_stats 
       WHERE user_id = ?`,
      [userId]
    );

    return (
      result || {
        total_km: 0,
        total_stops: 0,
        total_delivered: 0,
        total_not_handled: 0,
        total_time: 0,
        days_active: 0,
      }
    );
  } catch (error) {
    console.error("Error fetching total stats:", error);
    return {
      total_km: 0,
      total_stops: 0,
      total_delivered: 0,
      total_not_handled: 0,
      total_time: 0,
      days_active: 0,
    };
  }
}

/**
 * Reset today's stats for a user (useful for testing)
 */
export async function resetTodayStats(userId: string): Promise<void> {
  const db = await initDatabase();
  const today = getTodayDate();

  try {
    await db.runAsync("DELETE FROM user_stats WHERE user_id = ? AND date = ?", [
      userId,
      today,
    ]);
    console.log("✅ Today stats reset for user:", userId);
  } catch (error) {
    console.error("Error resetting stats:", error);
    throw error;
  }
}

/**
 * Clear all stats for a user (useful for cleanup)
 */
export async function clearUserStats(userId: string): Promise<void> {
  const db = await initDatabase();

  try {
    await db.runAsync("DELETE FROM user_stats WHERE user_id = ?", [userId]);
    console.log("✅ All stats cleared for user:", userId);
  } catch (error) {
    console.error("Error clearing user stats:", error);
    throw error;
  }
}

/**
 * Get database statistics (for debugging)
 */
export async function getDatabaseInfo(): Promise<{
  total_records: number;
  unique_users: number;
  oldest_record: string | null;
  newest_record: string | null;
}> {
  const db = await initDatabase();

  try {
    const result = await db.getFirstAsync<any>(
      `SELECT 
         COUNT(*) as total_records,
         COUNT(DISTINCT user_id) as unique_users,
         MIN(date) as oldest_record,
         MAX(date) as newest_record
       FROM user_stats`
    );

    return (
      result || {
        total_records: 0,
        unique_users: 0,
        oldest_record: null,
        newest_record: null,
      }
    );
  } catch (error) {
    console.error("Error fetching database info:", error);
    return {
      total_records: 0,
      unique_users: 0,
      oldest_record: null,
      newest_record: null,
    };
  }
}
