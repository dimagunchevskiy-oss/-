const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Срабатывает когда в push_queue появляется новая запись
exports.sendPushNotification = functions.database
  .ref("/push_queue/{pushId}")
  .onCreate(async (snap, context) => {
    const data = snap.val();
    if (!data || data.sent) return null;

    const { to: toUser, title, body, chatId } = data;

    try {
      // Получить FCM токен получателя
      const userSnap = await admin.database()
        .ref(`/users/${toUser}/fcmToken`).get();
      const token = userSnap.val();

      if (!token) {
        await snap.ref.update({ sent: true, error: "no_token" });
        return null;
      }

      // Отправить уведомление
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: { chatId: chatId || "" },
        android: {
          priority: "high",
          notification: {
            channelId: "messages",
            priority: "max",
            defaultSound: true,
            defaultVibrateTimings: true,
          }
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1 } }
        },
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            icon: "https://dm1trydm1trydevelop.github.io/-/icon-192.png",
            badge: "https://dm1trydm1trydevelop.github.io/-/icon-72.png",
            tag: chatId,
            renotify: true,
          },
          fcmOptions: {
            link: `https://dm1trydm1trydevelop.github.io/-/?chat=${chatId}`
          }
        }
      });

      // Пометить как отправлено
      await snap.ref.update({ sent: true });
      console.log(`✓ Push sent to ${toUser}`);
    } catch (e) {
      console.error("Push error:", e.message);
      await snap.ref.update({ sent: true, error: e.message });
    }
    return null;
  });

// Чистим старые записи каждый час
exports.cleanPushQueue = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const cutoff = Date.now() - 3600000; // 1 час
    const snap = await admin.database()
      .ref("/push_queue")
      .orderByChild("ts")
      .endAt(cutoff)
      .get();
    if (!snap.exists()) return null;
    const updates = {};
    snap.forEach(child => { updates[child.key] = null; });
    await admin.database().ref("/push_queue").update(updates);
    console.log(`Cleaned ${Object.keys(updates).length} old push entries`);
    return null;
  });