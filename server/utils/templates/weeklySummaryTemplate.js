function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' });
}

function renderWeeklySummary(data) {
  const { orgName, weekLabel, weekStart, weekEnd, health, totals, velocity, attendance, leave, projects, performers, stuckTasks, atRisk, recentActivity } = data;
  const healthColor = health.score >= 75 ? '#10B981' : health.score >= 50 ? '#F59E0B' : '#EF4444';
  const statusBadge = (s) => {
    const map = { ACTIVE: 'background:#10B981;color:#fff', ON_HOLD: 'background:#F59E0B;color:#fff', COMPLETED: 'background:#6366F1;color:#fff' };
    return `<span style="${map[s] || 'background:#6B7280;color:#fff'};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">${esc(s)}</span>`;
  };
  const riskBadge = (r) => {
    if (!r) return '';
    const c = r === 'High' ? 'background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5' : 'background:#FEF3C7;color:#D97706;border:1px solid #FCD34D';
    return `<span style="${c};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;">${r}</span>`;
  };

  const projectRows = (projects || []).map(p => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #EEE;font-size:12px;">
        <div style="font-weight:700;color:#111827;">${esc(p.name)}</div>
        <div style="font-size:11px;color:#6B7280;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc((p.description||'').slice(0,80))}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:4px;">Head: ${esc(p.headName||'Unassigned')} • Priority: ${p.priority_order ?? '-'}</div>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:center;">${statusBadge(p.status)}<div style="font-size:11px;color:#6B7280;margin-top:4px;">${p.progress ?? 0}% done</div></td>
      <td style="padding:10px 8px;border-bottom:1px solid #EEE;text-align:center;font-size:12px;">
        <div><b>${p.completedThisWeek ?? 0}</b> / ${p.totalTasks ?? 0} <span style="color:#6B7280;font-size:11px;">completed (week)</span></div>
        <div style="font-size:11px;color:#6B7280;">Created: ${p.createdThisWeek ?? 0} • Review: ${p.reviewThisWeek ?? 0} • Overdue: <span style="color:${(p.overdue||0)>0?'#DC2626':'#6B7280'};font-weight:700;">${p.overdue ?? 0}</span></div>
        <div style="font-size:11px;">Pts: <b>${p.pointsThisWeek ?? 0}</b> / ${p.totalPoints ?? 0}</div>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #EEE;font-size:11px;text-align:left;">
        <div>${esc((p.topPerformers||[]).map(x=> `${x.name} (${x.points})`).join(', ') || '—')}</div>
        <div style="margin-top:4px;">${riskBadge(p.risk)}</div>
        ${p.holdReason ? `<div style="color:#B45309;font-size:11px;margin-top:4px;">Hold: ${esc(p.holdReason)}</div>`:''}
      </td>
    </tr>
  `).join('');

  const atRiskBlock = (atRisk && atRisk.length) ? `
    <div style="margin:16px 0;padding:12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
      <div style="font-weight:700;color:#92400E;font-size:13px;margin-bottom:6px;">⚠️ At-Risk Projects (${atRisk.length})</div>
      ${atRisk.map(p=> `<div style="font-size:12px;color:#78350F;padding:4px 0;border-bottom:1px dashed #FDE68A;">${esc(p.name)} — ${p.overdueTasks>0?`Overdue ${p.overdueTasks}`:''} ${p.endDate?` Deadline ${fmtDate(p.endDate)}`:''} • ${p.riskFactor} • ${p.completionRate}%</div>`).join('')}
    </div>` : '';

  const stuckBlock = (stuckTasks && stuckTasks.length) ? `
    <div style="margin:16px 0;padding:12px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;">
      <div style="font-weight:700;color:#991B1B;font-size:13px;margin-bottom:6px;">🧊 Stuck Tasks &gt;5 days (${stuckTasks.length})</div>
      ${stuckTasks.slice(0,8).map(t=> `<div style="font-size:12px;color:#7F1D1D;padding:4px 0;border-bottom:1px dashed #FECACA;">${esc(t.description.slice(0,80))} — ${esc(t.status)} • ${esc(t.firstName||'') } ${esc(t.lastName||'')} • ${fmtDate(t.updatedAt)}</div>`).join('')}
      ${stuckTasks.length>8? `<div style="font-size:11px;color:#991B1B;margin-top:6px;">+ ${stuckTasks.length-8} more</div>`:''}
    </div>` : '';

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#F9FAFB;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:20px 24px;color:#fff;">
        <div style="font-size:12px;opacity:0.9;letter-spacing:0.08em;text-transform:uppercase;">${esc(orgName)} • Weekly CEO Summary</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px;">${esc(weekLabel)}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">${fmtDate(weekStart)} — ${fmtDate(weekEnd)} • Generated ${new Date().toLocaleString('en-IN', { timeZone:'Asia/Kolkata' })} IST</div>
      </div>

      <div style="padding:20px 24px;">
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
          <div style="flex:1;padding:12px;background:${healthColor}0D;border:1px solid ${healthColor}33;border-radius:12px;">
            <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Health Score</div>
            <div style="font-size:28px;font-weight:800;color:${healthColor};">${health.score}/100 <span style="font-size:12px;color:#6B7280;font-weight:600;">${health.delta!=null && health.delta!==0?(health.delta>0?'↑ +':'↓ ')+health.delta+' vs last week':'— vs last week'}</span></div>
            <div style="font-size:11px;color:#6B7280;">${esc(health.summary||'')}</div>
          </div>
          <div style="flex:1;padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
            <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Totals</div>
            <div style="font-size:13px;color:#111827;line-height:1.6;">
              Employees: <b>${totals.totalEmployees}</b> • Projects: <b>${totals.totalProjects}</b> • Points: <b>${totals.totalPoints}</b><br/>
              Tasks: pending <b>${totals.pending ?? 0}</b> • in-progress <b>${totals.inProgress ?? 0}</b> • review <b>${totals.review ?? 0}</b>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:140px;padding:12px;background:#EEF2FF;border-radius:12px;">
            <div style="font-size:11px;color:#4338CA;text-transform:uppercase;letter-spacing:0.06em;">Velocity This Week</div>
            <div style="font-size:13px;color:#111827;margin-top:6px;">Created <b>${velocity.created ?? 0}</b> • Completed <b>${velocity.completed ?? 0}</b> • Points <b>${velocity.points ?? 0}</b></div>
            <div style="font-size:11px;color:#6B7280;">Avg resolution ${velocity.avgResolutionHours ?? 0}h • Δ points ${velocity.pointsDelta!=null && velocity.pointsDelta!==0?(velocity.pointsDelta>0?'+':'')+velocity.pointsDelta:'—'}</div>
          </div>
          <div style="flex:1;min-width:140px;padding:12px;background:#ECFDF5;border-radius:12px;">
            <div style="font-size:11px;color:#065F46;text-transform:uppercase;letter-spacing:0.06em;">Presence</div>
            <div style="font-size:13px;color:#111827;margin-top:6px;">Present <b>${attendance.present ?? 0}</b> • Late <b>${attendance.late ?? 0}</b> • WFH <b>${attendance.wfh ?? 0}</b> • Leave <b>${attendance.leave ?? 0}</b></div>
            <div style="font-size:11px;color:#6B7280;">Missed checkout <b>${attendance.missed ?? 0}</b> • Geofence violations <b>${attendance.violations ?? 0}</b> • Device mismatch <b>${attendance.deviceMismatch ?? 0}</b></div>
          </div>
        </div>

        ${leave.pending? `<div style="padding:10px 12px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;font-size:12px;color:#92400E;">Leaves pending approval: <b>${leave.pending}</b> (oldest ${fmtDate(leave.oldest)})</div>`:''}

        <h2 style="font-size:14px;font-weight:800;color:#111827;margin:20px 0 8px;">📦 Projects Going On This Week (${(projects||[]).length})</h2>
        <div style="font-size:11px;color:#6B7280;margin-bottom:8px;">Only projects with tasks added. Dimmed = no movement this week.</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#F9FAFB;text-align:left;">
              <th style="padding:10px 8px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Project</th>
              <th style="padding:10px 8px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">Status</th>
              <th style="padding:10px 8px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">This Week</th>
              <th style="padding:10px 8px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Top / Risk</th>
            </tr>
          </thead>
          <tbody>
            ${projectRows || `<tr><td colspan="4" style="padding:20px;text-align:center;color:#6B7280;font-size:12px;">No projects</td></tr>`}
          </tbody>
        </table>

        ${atRiskBlock}
        ${stuckBlock}

        <h2 style="font-size:14px;font-weight:800;color:#111827;margin:20px 0 8px;">🏆 Performers This Week</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#F9FAFB;"><th style="padding:8px;font-size:11px;color:#6B7280;text-align:left;">Rank</th><th style="padding:8px;font-size:11px;color:#6B7280;text-align:left;">Employee</th><th style="padding:8px;font-size:11px;color:#6B7280;text-align:right;">Points</th><th style="padding:8px;font-size:11px;color:#6B7280;text-align:right;">Completed</th></tr></thead>
          <tbody>
            ${(performers||[]).slice(0,5).map((p,i)=> `<tr><td style="padding:8px;font-size:12px;border-bottom:1px solid #EEE;">#${i+1}</td><td style="padding:8px;font-size:12px;border-bottom:1px solid #EEE;">${esc(p.name|| (p.firstName+' '+p.lastName))}</td><td style="padding:8px;font-size:12px;text-align:right;border-bottom:1px solid #EEE;"><b>${p.weeklyPoints ?? p.totalPoints ?? 0}</b></td><td style="padding:8px;font-size:12px;text-align:right;border-bottom:1px solid #EEE;">${p.completedThisWeek ?? p.completedTasks ?? '-'}</td></tr>`).join('') || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#6B7280;font-size:12px;">No data</td></tr>`}
          </tbody>
        </table>

        ${recentActivity && recentActivity.length ? `
        <h2 style="font-size:14px;font-weight:800;color:#111827;margin:20px 0 8px;">🕒 Recent Activity</h2>
        <div style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
          ${recentActivity.slice(0,6).map(a=> `<div style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#111827;"><span style="color:#4F46E5;font-weight:700;">${esc(a.user)}</span> ${esc(a.action)} <span style="color:#6B7280;">${esc((a.target||'').slice(0,80))}</span> <span style="float:right;color:#9CA3AF;font-size:11px;">${esc(a.time)}</span></div>`).join('')}
        </div>`:''}

        <div style="margin-top:20px;padding:12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;text-align:center;">
          <a href="${esc(process.env.FRONTEND_URL?.split(',')[0]?.trim() || '#')}/dashboard" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block;">View Dashboard</a>
          <div style="font-size:11px;color:#6B7280;margin-top:8px;">You receive this because you enabled Weekly Reports in your profile. Disable anytime in Profile → Weekly CEO Report.</div>
        </div>
      </div>
      <div style="padding:12px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;font-size:11px;color:#9CA3AF;">
        ${esc(orgName)} • Auto-generated • ${esc(weekLabel)}
      </div>
    </div>
  </div>`;
  const text = `${orgName} Weekly Summary ${weekLabel} (${fmtDate(weekStart)} - ${fmtDate(weekEnd)})\nHealth ${health.score}/100\nTotals: Employees ${totals.totalEmployees} Projects ${totals.totalProjects} Points ${totals.totalPoints}\nProjects this week: ${(projects||[]).map(p=> `- ${p.name} [${p.status}] progress ${p.progress}% pts ${p.pointsThisWeek}/${p.totalPoints} overdue ${p.overdue}`).join('\n')}\n`;
  return { html, text };
}

module.exports = { renderWeeklySummary };
