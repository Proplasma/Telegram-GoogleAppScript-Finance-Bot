// securityGuard.js //
/**
 * ============================================================
 * MODULE: SECURITY GUARD & ANTI-REPLY-STORM (SRP)
 * Chuyên trách:
 * 1. Cầu chì dừng khẩn cấp (Emergency Stop / Circuit Breaker)
 * 2. Chống hiện tượng Telegram Bot Reply Storm (lặp lệnh/spam liên tục)
 *    bằng cơ chế 3 tầng:
 *    - Tầng 1: Kiểm tra cờ EMERGENCY_STOP
 *    - Tầng 2: Khử trùng lặp update_id (CacheService + ScriptProperties)
 *    - Tầng 3: Kiểm tra tuổi tin nhắn (Drop Stale Updates quá 180 giây)
 * ============================================================
 */

/**
 * Kiểm tra xem sự kiện Webhook từ Telegram có an toàn để xử lý hay không.
 * Trả về { allowed: true } nếu hợp lệ, hoặc { allowed: false, reason: "..." } nếu cần chặn.
 * @param {object} updateData - Payload JSON từ Telegram Webhook
 * @returns {{ allowed: boolean, reason: string }}
 */
function verifyWebhookSafety(updateData) {
  if (!updateData) {
    return { allowed: false, reason: "empty_update" };
  }

  // TẦNG 1: CẦU CHÌ DỪNG KHẨN CẤP (CIRCUIT BREAKER)
  if (getProperty("EMERGENCY_STOP") === "true") {
    Logger.log("🛑 [SecurityGuard] Bot đang ở trạng thái EMERGENCY_STOP. Bỏ qua Update.");
    return { allowed: false, reason: "emergency_stopped" };
  }

  // TẦNG 2: CHỐNG LẶP UPDATE_ID ĐA TẦNG (CACHE + SCRIPT PROPERTIES)
  if (updateData.update_id) {
    var updateId = Number(updateData.update_id);
    var cache = (typeof CacheService !== "undefined" && CacheService.getScriptCache)
      ? CacheService.getScriptCache()
      : null;
    var cacheKey = "tg_fin_update_" + updateId;

    // 2.1 Kiểm tra trong bộ nhớ đệm RAM (CacheService)
    if (cache && cache.get(cacheKey)) {
      Logger.log("⚡ [SecurityGuard - Cache] Chặn Update trùng lặp #" + updateId);
      return { allowed: false, reason: "duplicate_update_cache" };
    }

    // 2.2 Kiểm tra trong bộ nhớ bền vững (ScriptProperties)
    var scriptProps = (typeof PropertiesService !== "undefined" && PropertiesService.getScriptProperties)
      ? PropertiesService.getScriptProperties()
      : null;

    if (scriptProps) {
      var lastUpdateId = Number(scriptProps.getProperty("LAST_PROCESSED_UPDATE_ID") || "0");
      if (updateId <= lastUpdateId) {
        Logger.log("⚡ [SecurityGuard - Persistent] Chặn Update cũ/trùng #" + updateId + " (Đã xử lý tới #" + lastUpdateId + ")");
        if (cache) cache.put(cacheKey, "1", 21600);
        return { allowed: false, reason: "duplicate_update_persistent" };
      }
      // Ghi nhận ngay lập tức trước khi thực thi logic để tránh retry storm khi hàm xử lý lâu
      scriptProps.setProperty("LAST_PROCESSED_UPDATE_ID", String(updateId));
    }

    if (cache) {
      cache.put(cacheKey, "1", 21600); // Lưu 6 giờ
    }
  }

  // TẦNG 3: CHẶN TIN NHẮN CŨ BỊ DỒN Ứ (STALE MESSAGE PROTECTION)
  var msgObj = updateData.message || (updateData.callback_query && updateData.callback_query.message);
  if (updateData.message && updateData.message.date) {
    var nowUnix = Math.floor(Date.now() / 1000);
    var msgAgeSeconds = nowUnix - Number(updateData.message.date);
    var maxAge = (typeof CONFIG !== "undefined" && CONFIG.MAX_MESSAGE_AGE_SECONDS) ? CONFIG.MAX_MESSAGE_AGE_SECONDS : 180;

    if (msgAgeSeconds > maxAge) {
      Logger.log("⚠️ [SecurityGuard - Stale] Bỏ qua tin nhắn cũ quá hạn (" + msgAgeSeconds + "s > " + maxAge + "s).");
      return { allowed: false, reason: "stale_message_dropped" };
    }
  }

  return { allowed: true, reason: "ok" };
}

/**
 * HÀM DỪNG KHẨN CẤP TRÊN GOOGLE APPS SCRIPT (EMERGENCY KILL SWITCH)
 * Có thể chạy trực tiếp từ trình soạn thảo GAS, từ lệnh Telegram /stop_emergency, hoặc từ CLI
 */
function EmergencyStop() {
  try {
    setProperty("EMERGENCY_STOP", "true");

    // Ngắt Webhook và xóa toàn bộ hàng đợi tin nhắn đang kẹt trên Telegram
    if (typeof deleteTelegramWebhook === "function") {
      deleteTelegramWebhook(true);
    }

    // Xóa tất cả các trigger tự động (nếu có) để tránh chạy ngầm
    if (typeof ScriptApp !== "undefined" && ScriptApp.getProjectTriggers) {
      var triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    Logger.log("\n🛑 ==========================================");
    Logger.log("🛑 ĐÃ KÍCH HOẠT DỪNG KHẨN CẤP (EMERGENCY STOP)!");
    Logger.log("1. Đã bật cờ khoá EMERGENCY_STOP = true.");
    Logger.log("2. Đã xóa Webhook và hủy toàn bộ hàng đợi tin nhắn (drop_pending_updates = true).");
    Logger.log("3. Đã hủy toàn bộ Time Triggers.");
    Logger.log("==========================================\n");
    return { ok: true, status: "EMERGENCY_STOPPED" };
  } catch (e) {
    Logger.log("❌ Lỗi khi thực thi EmergencyStop: " + e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * HÀM KHÔI PHỤC HOẠT ĐỘNG BOT SAU KHI DỪNG KHẨN CẤP
 */
function ResumeBot() {
  try {
    setProperty("EMERGENCY_STOP", "false");
    var webAppUrl = getProperty("WEBAPP_URL");
    if (webAppUrl && typeof setTelegramWebhook === "function") {
      setTelegramWebhook(webAppUrl, true);
    }
    Logger.log("✅ ĐÃ MỞ KHOÁ EMERGENCY_STOP VÀ KHÔI PHỤC HOẠT ĐỘNG BOT!");
    return { ok: true, status: "RESUMED" };
  } catch (e) {
    Logger.log("❌ Lỗi khi thực thi ResumeBot: " + e.message);
    return { ok: false, error: e.message };
  }
}

// Export cho môi trường Node.js Local Dev
if (typeof module !== "undefined" && module.exports) {
  global.verifyWebhookSafety = verifyWebhookSafety;
  global.EmergencyStop = EmergencyStop;
  global.ResumeBot = ResumeBot;

  module.exports = {
    verifyWebhookSafety: verifyWebhookSafety,
    EmergencyStop: EmergencyStop,
    ResumeBot: ResumeBot
  };
}
