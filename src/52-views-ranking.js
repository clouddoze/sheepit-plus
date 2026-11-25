/* ==== 52-views-ranking.js：排行榜 / 团队榜 / 团队详情 ====
   独立 IIFE：公共件从 45-view-kit 取，跨视图状态挂 SP.Views。 */
(function () {
  'use strict';
  const SP = window.__SHEEPIT_PLUS__;
  if (!SP) return;
  const { Util, UI, t, I18n } = { Util: SP.Util, UI: SP.UI, t: SP.t, I18n: SP.I18n };
  const { esc, fmt, foot, moreRow , pageSize, sechead, emptyRow } = SP.VK;

  /* 重复注入（同一页里再 eval 一次产物）时不要把委托监听挂两遍。 */
  if (SP.Views && SP.Views.rankState) return;

  /* 排行榜的每页条数（原放在 51 里，跟着视图走）；limit 由 80-app 的 #sp-more 统一加。
     tab / sect：这一页里的两档（用户榜 / 机器榜），机器榜再分站点那四张表。 */
  const rankState = {
    limit: pageSize(),
    tab: location.pathname === '/ranking/machine' ? 'machine' : 'user',
    sect: 'cpus',
    machineErr: '',
    uq: '',   // 用户榜搜索
    mq: '',   // 机器榜搜索
  };
  /** 两档共用的切换控件。点击由本文件末尾的委托监听处理（80-app 的事件表只认 data-act，
      这两个档位是排行榜自己的状态，不该塞进它那张表里）。 */
  const rankSeg = () => `<div class="toolbar"><div class="seg" id="sp-rank-tab">${[['user', t('rank.tab.user')], ['machine', t('rank.tab.machine')]]
    .map(([k, label]) => `<button data-t="${k}" aria-pressed="${rankState.tab === k}">${esc(label)}</button>`).join('')}</div></div>`;

  /* ==== 排行榜：用户档 ==== */

  function usersRank(state) {
    const rows = state.ranking || [];
    /* 用户榜为空时也要留切换控件：否则站点哪天把 /ranking/user 换掉，机器档就再也进不去了 */
    if (!rows.length) return rankSeg() + UI.state.empty();
    const q = rankState.uq.trim().toLowerCase();
    const shown = q ? rows.filter((r) => String(r.user || r.userId).toLowerCase().includes(q)) : rows;
    const me = state.userName;
    const body = shown.slice(0, rankState.limit).map((r) => {
      const isMe = me && r.user === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight">${esc(r.rank)}</td>
        <td><div class="ow">${UI.avatar(r.avatar, r.user, 'ini')}
          ${r.user || r.userId
            ? `<a class="nm" href="/user/${encodeURIComponent(r.userId || r.user)}/profile" target="_self" title="${esc(r.user)}">${esc(r.user || r.userId)}</a>`
            : ''}</div></td>
        <td class="r num">${esc(Util.num(r.frames))}</td>
        <td class="r num">${esc(Util.duration(r.seconds))}</td>
        <td class="r num">${esc(Util.num(Math.round(r.points)))}</td>
      </tr>`;
    }).join('');

    return `${sechead({ title: esc(t('rank.title')), sub: esc(t('rank.sub')), right: `<span class="sub num">${esc(t('rank.count', { n: rows.length }))}</span>` })}
      ${rankSeg()}
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-rq" type="search" placeholder="${esc(t('rank.search'))}" value="${esc(rankState.uq)}">
        </label>
        <span class="sub num">${esc(t('rank.showing', { n: Math.min(shown.length, rankState.limit), total: shown.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl">
          <thead><tr>
            <th scope="col" class="tight">${esc(t('rank.col.rank'))}</th><th scope="col">${esc(t('rank.col.user'))}</th>
            <th scope="col" class="r">${esc(t('rank.col.frames'))}</th><th scope="col" class="r">${esc(t('rank.col.time'))}</th>
            <th scope="col" class="r">${esc(t('rank.col.points'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(shown.length, rankState.limit), shown.length, 100)}
      </div>`;
  }

  /* ==== 排行榜：机器档 ====
     站点 /ranking/machine 是四张独立的表（CPU / GPUs OPTIX / HIP / METAL），服务端已按强度降序排好。
     一次只画一张：CPU 表 5900+ 行，四张一起画会把首屏按住好几秒；分页沿用 rankState.limit
     （80-app 的 #sp-more 会 +100 再 render，和用户档同一条路）。
     段名沿用站点的后端名，不翻译。 */
  const MACH_SECTS = ['cpus', 'optix', 'hip', 'metal'];
  /* 段名就是站点的后端名，中英都一样 —— 不占词条，也不该被"翻译"成别的说法。 */
  const MACH_LABELS = { cpus: 'CPU', optix: 'GPU · OPTIX', hip: 'GPU · HIP', metal: 'GPU · METAL' };
  const machineTotal = (m) => (m ? MACH_SECTS.reduce((n, k) => n + ((m[k] || []).length), 0) : 0);

  /* 进行中的取数：渲染是同步的，这里只发请求，回来由 loadMachine 自己再 render 一次。
     模块级是因为「渲染 → 排加载 → 再渲染」这条环必须有个闸，否则 render 一次就抓一次。 */
  let machineLoading = false;

  async function loadMachine(force) {
    const S = SP.app && SP.app.state;
    if (!S || machineLoading) return;
    if (S.machine && !force) return;
    machineLoading = true;
    rankState.machineErr = '';
    try {
      const path = '/ranking/machine';
      /* 当前页就是数据源时直接解析活 document，省一次约 2.8 MB 的整页下载
         （和 80-app 里 /ranking/user 的处理同一策略）。 */
      const doc = SP.Api.currentDoc(path);
      let data = doc ? SP.Api.parseMachineRanking(doc) : null;
      if (!data || !machineTotal(data)) data = SP.Api.parseMachineRanking(await SP.Api.fetchPage(path));
      S.machine = data;
    } catch (e) {
      rankState.machineErr = e && e.code === 'SIGNED_OUT' ? t('state.loggedOut') : ((e && e.message) || String(e));
    } finally {
      machineLoading = false;
      if (SP.app && SP.app.state.view === 'ranking') SP.app.render();
    }
  }

  function machineRank(state) {
    const m = state.machine;
    /* 还没取到数据时不印「共 0 款机型」—— 那是"没加载"，不是"确实没有" */
    const head = `${sechead({ title: esc(t('rank.machine.title')), sub: esc(t('rank.machine.sub')), right: (m ? `<span class="sub num">${esc(t('rank.machine.count', { n: machineTotal(m) }))}</span>` : '') })}`;
    if (!m) {
      /* 第一次切到机器档（或直接打开 /ranking/machine）时在这里排一次加载。
         失败过就不再自动重排：给错误态和一个重试按钮，别在 render 里空转。 */
      if (!machineLoading && !rankState.machineErr) queueMicrotask(loadMachine);
      return head + rankSeg() + (rankState.machineErr
        ? UI.state.error(rankState.machineErr, 'sp-mach-retry')
        : UI.skeleton(4));
    }
    const sect = MACH_SECTS.indexOf(rankState.sect) >= 0 ? rankState.sect : 'cpus';
    const gpu = sect !== 'cpus';
    const all = m[sect] || [];
    const mq = rankState.mq.trim().toLowerCase();
    const list = mq ? all.filter((r) => String(r.model).toLowerCase().includes(mq)) : all;
    const body = list.slice(0, rankState.limit).map((r) => `<tr class="${r.mine ? 'me' : ''}">
        <td><div class="pn" title="${esc(r.model)}">${esc(r.model)}</div></td>
        ${gpu ? `<td class="r num">${esc(r.memoryText || '—')}</td>` : ''}
        <td class="r num" title="${esc(r.powerText)}">${esc(r.powerText)}</td>
      </tr>`).join('') || emptyRow(gpu ? 3 : 2, esc(t('rank.machine.empty')));

    const sectSeg = `<div class="seg" id="sp-mach">${MACH_SECTS.map((k) =>
    `<button data-m="${k}" aria-pressed="${sect === k}">${esc(MACH_LABELS[k])}
        <span class="num">${(m[k] || []).length}</span></button>`).join('')}</div>`;

    return head + rankSeg() + `<div class="toolbar">${sectSeg}</div>
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-mq" type="search" placeholder="${esc(t('rank.machine.search'))}" value="${esc(rankState.mq)}">
        </label>
        <span class="sub num">${esc(t('rank.showing', { n: Math.min(list.length, rankState.limit), total: list.length }))}</span>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-mach">
          <thead><tr><th scope="col">${esc(t('rank.machine.col.model'))}</th>
            ${gpu ? `<th scope="col" class="r">${esc(t('rank.machine.col.memory'))}</th>` : ''}
            <th scope="col" class="r">${esc(t('rank.machine.col.power'))}</th></tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(list.length, rankState.limit), list.length, 100)}
      </div>`;
  }

  /** 入口：两档都在这一页里，不换路由 —— 切档只是本视图内部换一份数据。 */
  function ranking(state) {
    return rankState.tab === 'machine' ? machineRank(state) : usersRank(state);
  }

  /* ==== 团队榜 ==== */
  const teamsState = { q: '', limit: pageSize() };

  function teams(state) {
    const all = state.teams || [];
    if (!all.length) return UI.state.empty();
    const q = teamsState.q.trim().toLowerCase();
    const rows = all.filter((x) => !q || String(x.name).toLowerCase().includes(q));
    const mineId = state.myTeam && state.myTeam.id ? String(state.myTeam.id) : '';
    const body = rows.length ? rows.slice(0, teamsState.limit).map((x) => {
      const mine = !!mineId && String(x.id) === mineId;
      return `<tr class="${mine ? 'me' : ''}">
        <td class="rankcell tight">${esc(x.rank)}</td>
        <td>${x.id
    ? `<a class="nm" href="/team/${esc(x.id)}" target="_self">${esc(x.name)}</a>`
    : esc(x.name)}</td>
        <td class="r num">${esc(x.p90Text)}</td>
        <td class="r num">${esc(x.p180Text)}</td>
        <td class="r num">${esc(x.totalText)}</td>
        <td class="r num">${esc(x.membersText)}</td>
      </tr>`;
    }).join('') : emptyRow(6, esc(t('team.none')));

    /* 我的团队单独一行：榜单按积分排，自己那个队可能在第 1600 名，分页里根本看不到 */
    const mine = mineId ? all.find((x) => String(x.id) === mineId) : null;
    const mineLine = mine
      ? `<div class="toolbar"><span class="sub">${esc(t('team.mine'))}
          <a href="/team/${esc(mine.id)}" target="_self"><b>${esc(mine.name)}</b></a>
          ${esc(t('team.rankLine', { rank: mine.rank }))}</span></div>`
      : '';
    /* 创建入口只在登录时出现（站点对未登录用户只给一句"需要登录"） */
    const createForm = state.userName
      ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
          <div class="phead"><h2>${esc(t('team.create'))}</h2></div>
          <div class="teamcreate">
            <label class="input"><input id="sp-tname" type="text" maxlength="70" autocomplete="off" placeholder="${esc(t('team.createName'))}"></label>
            <button class="btn primary" data-act="team-create" data-input="sp-tname">${esc(t('team.createGo'))}</button>
          </div>
          <p class="hint">${esc(t('team.createHint'))}</p>
        </div>`
      : '';

    return `${sechead({ title: esc(t('team.title')), sub: esc(t('team.sub')), right: `<span class="sub num">${esc(t('team.count', { n: all.length }))}</span>` })}
      <div class="toolbar">
        <label class="input">${UI.icon('search')}
          <input id="sp-tq" type="search" placeholder="${esc(t('team.search'))}" value="${esc(teamsState.q)}">
        </label>
      </div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-teams">
          <colgroup><col class="c-rank"><col class="c-name"><col class="c-90"><col class="c-180"><col class="c-total"><col class="c-mem"></colgroup>
          <thead><tr>
            <th scope="col" class="tight">${esc(t('team.col.rank'))}</th><th scope="col">${esc(t('team.col.name'))}</th>
            <th scope="col" class="r">${esc(t('team.col.p90'))}</th><th scope="col" class="r">${esc(t('team.col.p180'))}</th>
            <th scope="col" class="r">${esc(t('team.col.total'))}</th><th scope="col" class="r">${esc(t('team.col.members'))}</th>
          </tr></thead><tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(rows.length, teamsState.limit), rows.length, 100)}
      </div>
      ${createForm}`;
  }

  /* ==== 团队详情 ==== */
  const teamState = { limit: pageSize() };

  function teamDetail(state) {
    const d = state.team;
    if (!d) return UI.state.empty();
    const me = state.userName || '';
    /* 团队在榜上的名次：从已经加载的榜单里查（没加载就不显示，不为了一行排名再拖 1.6MB） */
    const row = (state.teams || []).find((x) => String(x.id) === String(state.teamId || ''));
    const rank = row ? row.rank : '';
    const disband = d.deleteUrl
      ? `<button class="btn" data-act="team-act" data-team-act="disband" data-url="${esc(d.deleteUrl)}" data-confirm="${esc(t('team.disbandConfirm'))}" style="color:var(--accent)">${esc(t('team.disband'))}</button>`
      : '';
    const act = d.leaveUrl
      ? `<button class="btn" data-act="team-act" data-team-act="leave" data-url="${esc(d.leaveUrl)}" data-confirm="${esc(t('team.leaveConfirm'))}">${esc(t('team.leave'))}</button>`
      : (d.joinUrl
        ? `<button class="btn primary" data-act="team-act" data-team-act="join" data-url="${esc(d.joinUrl)}" data-confirm="${esc(t('team.joinConfirm'))}">${esc(t('team.join'))}</button>`
        : '');

    const members = d.members || [];
    const body = members.slice(0, teamState.limit).map((m) => {
      const isMe = !!me && !!m.userId && m.userId === me;
      return `<tr class="${isMe ? 'me' : ''}">
        <td class="rankcell tight"><span class="rankpill${m.rendering ? ' on' : ''}"${m.rendering ? ` title="${esc(t('team.rendering'))}"` : ''}>${esc(m.rank)}</span></td>
        <td><div class="ow">${UI.avatar(m.avatar, m.user, 'ini')}
          ${m.userId
    ? `<a class="nm" href="/user/${encodeURIComponent(m.userId)}/profile" target="_self">${esc(m.user)}</a>`
    : esc(m.user)}</div></td>
        <td class="r num">${esc(m.pointsText)}</td>
        <td class="r num">${esc(m.joined)}</td>
        ${d.hasLastFrame ? `<td class="r num">${esc(m.lastFrame || '—')}</td>` : ''}
        ${d.hasRemove ? `<td class="r">${m.removeUrl ? `<button class="btn sm" data-act="team-act" data-url="${esc(m.removeUrl)}" data-confirm="${esc(t('team.removeConfirm'))}">${esc(t('team.remove'))}</button>` : ''}</td>` : ''}
      </tr>`;
    }).join('') || emptyRow(4, esc(t('team.noMembers')), '30px 12px');

    return `<div class="sechead"><h2>${esc(d.name)}</h2>
        <span class="sub num">${esc(d.pointsText)}</span>
        ${rank ? `<span class="sub">${esc(t('team.rankLine', { rank }))}</span>` : ''}
        <span class="spacer"></span>
        ${disband}
        ${act}
        <a class="btn" href="/team" target="_self">${esc(t('team.back'))}</a></div>
      <div class="panel" style="padding:14px 6px 6px">
        <div class="tablewrap" tabindex="0"><table class="tbl tbl-team${d.hasRemove ? ' tbl-team-6' : (d.hasLastFrame ? ' tbl-team-5' : '')}">
          <colgroup><col class="c-rank"><col class="c-member"><col class="c-pts"><col class="c-date">${d.hasLastFrame ? '<col class="c-last">' : ''}${d.hasRemove ? '<col class="c-rm">' : ''}</colgroup>
          <thead><tr><th scope="col" class="tight">${esc(t('team.col.rank'))}</th><th scope="col">${esc(t('team.col.member'))}</th>
            <th scope="col" class="r">${esc(t('team.col.points'))}</th><th scope="col" class="r">${esc(t('team.col.joined'))}</th>${d.hasLastFrame ? `<th scope="col" class="r">${esc(t('team.col.lastFrame'))}</th>` : ''}${d.hasRemove ? `<th scope="col" class="r">${esc(t('team.col.remove'))}</th>` : ''}</tr></thead>
          <tbody>${body}</tbody>
        </table></div>
        ${moreRow(Math.min(members.length, teamState.limit), members.length, 100)}
      </div>
      ${d.update ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
        <div class="phead"><h2>${esc(t('team.update'))}</h2><span class="sub">${esc(t('team.updateSub'))}</span></div>
        <div class="addrow"><label class="input"><input id="sp-tname" type="text" maxlength="70" value="${esc(d.update.name)}" placeholder="${esc(t('team.updateName'))}"></label></div>
        <div class="addrow"><label class="input"><input id="sp-tdesc" type="text" value="${esc(d.update.description)}" placeholder="${esc(t('team.updateDesc'))}"></label></div>
        <div class="addrow"><button class="btn primary" data-act="team-update" data-url="${esc(d.update.url)}">${esc(t('team.updateGo'))}</button></div>
      </div>` : ''}
      ${(d.requests || []).length ? `<div class="panel" style="margin-top:16px;padding:16px 20px">
        <div class="phead"><h2>${esc(t('team.requests'))}</h2><span class="sub">${esc(t('team.requestsSub', { n: d.requests.length }))}</span></div>
        <div class="ulist">${d.requests.map((r) => `<div class="u">
          ${UI.avatar(r.avatar, r.user, 'ini')}
          <span class="n">${r.userId ? `<a href="/user/${encodeURIComponent(r.userId)}/profile" target="_self">${esc(r.user)}</a>` : esc(r.user)}</span>
          <span class="sub">${esc(r.time)}</span>
          <span class="spacer"></span>
          ${r.accept ? `<button class="btn sm primary" data-act="team-act" data-url="${esc(r.accept)}">${esc(t('team.accept'))}</button>` : ''}
          ${r.refuse ? `<button class="btn sm" data-act="team-act" data-url="${esc(r.refuse)}" data-confirm="${esc(t('team.refuseConfirm'))}">${esc(t('team.refuse'))}</button>` : ''}
        </div>`).join('')}</div>
      </div>` : ''}`;
  }

  /* 两档切换 / 机器档四个分段 / 加载失败的重试：都是本视图的私有控件，
     自己挂一个委托监听（80-app 的事件表按 data-act 派发，这些不该塞进去）。
     一个 closest 认三种目标，免得三个监听器抢同一个点击。 */
  /* 两档各自的搜索框：输入即过滤，保留光标（和项目列表同一套手感）。 */
  document.addEventListener('input', (ev) => {
    const id = ev.target && ev.target.id;
    if (id !== 'sp-rq' && id !== 'sp-mq') return;
    const v = ev.target.value;
    if (id === 'sp-rq') rankState.uq = v; else rankState.mq = v;
    clearTimeout(rankState.timer);
    rankState.timer = setTimeout(() => {
      const pos = ev.target.selectionStart;
      if (SP.app) SP.app.render();
      const again = document.getElementById(id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* noop */ } }
    }, 180);
  });

  document.addEventListener('click', (ev) => {
    const tgt = ev.target && ev.target.closest
      ? ev.target.closest('#sp-rank-tab [data-t], #sp-mach [data-m], #sp-mach-retry')
      : null;
    if (!tgt) return;
    /* 只在排行榜视图里生效：切走后 #sp-body 已经换内容，迟到的点击不该再改状态 */
    if (!SP.app || SP.app.state.view !== 'ranking') return;
    if (tgt.id === 'sp-mach-retry') {
      rankState.machineErr = '';
      loadMachine(true);
      return;
    }
    if (tgt.dataset.t) {
      const v = tgt.dataset.t === 'machine' ? 'machine' : 'user';
      if (rankState.tab === v) return;
      rankState.tab = v;
      rankState.limit = pageSize();   // 换档从头一页看起，别带着上一档「更多」撑大的行数
      if (v === 'machine') loadMachine();
      SP.app.render();
      return;
    }
    const m = tgt.dataset.m;
    if (m && MACH_SECTS.indexOf(m) >= 0 && rankState.sect !== m) {
      rankState.sect = m;
      rankState.limit = pageSize();
      SP.app.render();
    }
  });

  SP.Views = SP.Views || {};
  Object.assign(SP.Views, { ranking, teams, teamDetail, rankState, teamsState, teamState });
})();