"use client";

/**
 * Last-resort boundary: replaces the whole document when even the root layout
 * fails, so it must ship its own <html>/<body> and cannot rely on app styles.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#0A0C10",
          color: "#EEF2F8",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          Приложение не запустилось
        </h1>
        <p style={{ fontSize: 13, color: "#8D97A8", maxWidth: 320, margin: 0 }}>
          Произошла критическая ошибка. Данные не пострадали.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            cursor: "pointer",
            border: 0,
            borderRadius: 16,
            padding: "12px 20px",
            fontSize: 15,
            fontWeight: 700,
            background: "#5B9EFF",
            color: "#06101F",
          }}
        >
          Перезагрузить
        </button>
      </body>
    </html>
  );
}
