// HTML/text templates for backlog reminder + HR defaulter report emails.

function fmt(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v.toFixed(2);
}

function dayRowsHtml(days) {
  return days
    .map(
      (d) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.date}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.label}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.required)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.worked)}</td>
      </tr>`
    )
    .join('');
}

function renderBacklogReminder({ employeeName, orgName, weekStart, weekEnd, isOffWeek, backlogSoFar, todayTarget, requiredSoFar, workedSoFar, days }) {
  const subject = `Backlog reminder — ${orgName} • ${weekStart} to ${weekEnd}`;
  const saturdayNote = isOffWeek
    ? 'Note: 2nd/4th Saturday is off, so please close your backlog today (Friday).'
    : 'Note: Saturday is a working day this week — please close your backlog today (Saturday).';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#4F46E5;margin:0 0 8px;">Hi ${employeeName}, your backlog reminder</h2>
      <p style="color:#333;">Week <b>${weekStart}</b> to <b>${weekEnd}</b> (${orgName}). Daily requirement is <b>9.00 hrs</b>.</p>
      <p style="color:#333;">${saturdayNote}</p>
      <div style="display:flex;gap:12px;margin:16px 0;">
        <div style="flex:1;background:#f5f5ff;border:1px solid #e0e0ff;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:12px;color:#666;">BACKLOG SO FAR</div>
          <div style="font-size:24px;font-weight:700;color:#d97706;">${fmt(backlogSoFar)}h</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:12px;color:#666;">TARGET FOR TODAY</div>
          <div style="font-size:24px;font-weight:700;color:#15803d;">${fmt(todayTarget)}h</div>
        </div>
      </div>
      <p style="color:#555;font-size:13px;">Required so far: ${fmt(requiredSoFar)}h • Worked so far: ${fmt(workedSoFar)}h (holidays &amp; approved leaves are already adjusted).</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;">
        <thead><tr style="background:#f8f8f8;">
          <th style="padding:6px 10px;text-align:left;">Date</th>
          <th style="padding:6px 10px;text-align:left;">Day</th>
          <th style="padding:6px 10px;text-align:right;">Required</th>
          <th style="padding:6px 10px;text-align:right;">Worked</th>
        </tr></thead>
        <tbody>${dayRowsHtml(days)}</tbody>
      </table>
      <p style="font-size:12px;color:#888;margin-top:16px;">If anything looks wrong (leave not reflected, missing checkout), please contact HR.</p>
    </div>`;
  const text = `Hi ${employeeName},\nWeek ${weekStart} to ${weekEnd} (${orgName}). Backlog so far: ${fmt(backlogSoFar)}h. Target for today: ${fmt(todayTarget)}h. Required so far ${fmt(requiredSoFar)}h, worked ${fmt(workedSoFar)}h.`;
  return { subject, html, text };
}

function renderBacklogHrReport({ orgName, weekStart, weekEnd, isOffWeek, defaulters, totalEmployees, allClear }) {
  const subject = allClear
    ? `Backlog clear — ${orgName} • ${weekStart} to ${weekEnd}`
    : `Backlog defaulters — ${orgName} • ${weekStart} to ${weekEnd}`;
  const rows = defaulters
    .map(
      (d) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${d.name}<br/><span style="color:#888;font-size:12px;">${d.email}</span></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.required)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(d.worked)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#b91c1c;">${fmt(d.remaining)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;">${d.flags}</td>
      </tr>`
    )
    .join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #eee;">
      <h2 style="color:#4F46E5;margin:0 0 8px;">Backlog report — ${orgName}</h2>
      <p style="color:#333;">Week <b>${weekStart}</b> to <b>${weekEnd}</b> (${isOffWeek ? '2nd/4th Saturday off week, closed Friday' : 'Saturday working week, closed Saturday'}). Checked ${totalEmployees} employees.</p>
      ${allClear ? '<p style="color:#15803d;font-weight:700;">All clear — no backlog defaulters today.</p>' : `
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#333;">
        <thead><tr style="background:#f8f8f8;">
          <th style="padding:6px 10px;text-align:left;">Employee</th>
          <th style="padding:6px 10px;text-align:right;">Required</th>
          <th style="padding:6px 10px;text-align:right;">Worked</th>
          <th style="padding:6px 10px;text-align:right;">Shortfall</th>
          <th style="padding:6px 10px;text-align:left;">Notes</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
  const text = allClear
    ? `Backlog clear for ${orgName} (${weekStart} to ${weekEnd}).`
    : `Backlog defaulters for ${orgName} (${weekStart} to ${weekEnd}):\n` +
      defaulters.map((d) => `- ${d.name} <${d.email}>: shortfall ${fmt(d.remaining)}h (req ${fmt(d.required)}, worked ${fmt(d.worked)}) ${d.flags}`).join('\n');
  return { subject, html, text };
}

module.exports = { renderBacklogReminder, renderBacklogHrReport };
