// Shows a banner based on a code in the URL, like ?msg=created or ?err=failed.
// Example: <FlashMessage code={sp.msg} messages={{ created: "Patient created." }} />
const TONES = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

export default function FlashMessage({ code, messages, tone = "success" }) {
  const text = code ? messages[code] : null;
  if (!text) return null;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}>
      {text}
    </div>
  );
}
