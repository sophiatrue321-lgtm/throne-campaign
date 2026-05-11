/* ============================================================
   THRONE CAMPAIGN — Admin Page
   Auth via Supabase. RLS enforces admin-only access on writes.
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  /* --- Auth ---------------------------------------------------- */
  
  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      showDashboard(session);
    } else {
      showLogin();
    }
  }
  
  function showLogin() {
    document.getElementById('login-state').hidden = false;
    document.getElementById('dashboard-state').hidden = true;
  }
  
  function showDashboard(session) {
    document.getElementById('login-state').hidden = true;
    document.getElementById('dashboard-state').hidden = false;
    document.getElementById('user-email').textContent = session.user.email;
    
    // Load all dashboard data
    loadQueue();
    loadThermometers();
    loadStats();
  }
  
  /* --- Login form --------------------------------------------- */
  
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      loginError.textContent = error.message;
      loginError.hidden = false;
      return;
    }
    
    if (data.session) {
      showDashboard(data.session);
    }
  });
  
  /* --- Sign out ------------------------------------------------ */
  
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
  });
  
  /* --- Tabs ---------------------------------------------------- */
  
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tab states
      document.querySelectorAll('.admin-tab').forEach(t => 
        t.classList.toggle('admin-tab--active', t === tab)
      );
      
      // Show/hide sections
      document.getElementById('queue-section').hidden = tabName !== 'queue';
      document.getElementById('thermometers-section').hidden = tabName !== 'thermometers';
      document.getElementById('recovery-section').hidden = tabName !== 'recovery';
      document.getElementById('ledger-section').hidden = tabName !== 'ledger';
      document.getElementById('stats-section').hidden = tabName !== 'stats';
      
      // Refresh data when entering a tab
      if (tabName === 'queue') loadQueue();
      if (tabName === 'thermometers') loadThermometers();
      if (tabName === 'ledger') loadLedger(true);
      if (tabName === 'stats') loadStats();
    });
  });
  
  /* --- Queue --------------------------------------------------- */
  
  async function loadQueue() {
    const list = document.getElementById('queue-list');
    list.innerHTML = '<p class="admin-empty">Loading queue...</p>';
    
    const { data, error } = await supabase
      .from('admin_pending_claims')
      .select('*');
    
    if (error) {
      console.error('Queue load error:', error);
      list.innerHTML = '<p class="admin-empty">Failed to load queue. Are you in the admins table?</p>';
      return;
    }
    
    document.getElementById('queue-count').textContent = data.length;
    
    if (data.length === 0) {
      list.innerHTML = '<p class="admin-empty">No pending claims. The throne rests.</p>';
      return;
    }
    
    list.innerHTML = '';
    data.forEach(claim => {
      const card = document.createElement('div');
      card.className = 'claim-card';
      card.dataset.claimId = claim.id;
      
      const proofHtml = claim.proof_url 
        ? `<a href="${escapeHtml(claim.proof_url)}" target="_blank" rel="noopener noreferrer">View Proof ↗</a>`
        : '<span style="opacity:0.5">No proof provided</span>';
      
      const notesHtml = claim.notes 
        ? `<div class="claim-card__notes">"${escapeHtml(claim.notes)}"</div>`
        : '';
      
      const submittedTime = new Date(claim.submitted_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      // Distinguish qualifying tributes from item contributions
      const isContribution = claim.claim_type === 'contribution';
      const typeBadge = isContribution
        ? `<span class="claim-card__type-badge claim-card__type-badge--contribution">Item Contribution</span>`
        : `<span class="claim-card__type-badge claim-card__type-badge--qualifying">Qualifying Tribute</span>`;
      
      const itemFieldHtml = isContribution && claim.item_name
        ? `<div class="claim-card__field">
            <span class="claim-card__field-label">Allocated To</span>
            <span class="claim-card__field-value claim-card__field-value--item">${escapeHtml(claim.item_name)}</span>
          </div>`
        : '';
      
      card.innerHTML = `
        <div class="claim-card__main">
          <div class="claim-card__type-row">${typeBadge}</div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Handle</span>
            <span class="claim-card__field-value">${escapeHtml(claim.sub_handle)}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Platform</span>
            <span class="claim-card__field-value">${escapeHtml(claim.platform)}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Amount</span>
            <span class="claim-card__field-value claim-card__field-value--amount">£${Number(claim.amount).toLocaleString('en-GB')}</span>
          </div>
          ${itemFieldHtml}
          <div class="claim-card__field">
            <span class="claim-card__field-label">Submitted</span>
            <span class="claim-card__field-value">${submittedTime}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Proof</span>
            <span class="claim-card__field-value">${proofHtml}</span>
          </div>
          ${notesHtml}
        </div>
        <div class="claim-card__actions">
          <button class="claim-card__btn claim-card__btn--approve" data-action="approve">
            ✓ Approve
          </button>
          <button class="claim-card__btn claim-card__btn--reject" data-action="reject">
            ✗ Reject
          </button>
        </div>
      `;
      list.appendChild(card);
    });
    
    // Wire approve/reject buttons
    list.querySelectorAll('.claim-card__btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.claim-card');
        const claimId = card.dataset.claimId;
        const action = btn.dataset.action;
        
        const buttons = card.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        
        const fnName = action === 'approve' ? 'admin_approve_claim' : 'admin_reject_claim';
        
        const { data: { session } } = await supabase.auth.getSession();
        const reviewer = session?.user?.email || 'admin';
        
        const { data, error } = await supabase.rpc(fnName, {
          claim_id: claimId,
          reviewer: reviewer,
        });
        
        if (error) {
          console.error(action + ' error:', error);
          alert('Failed: ' + error.message);
          buttons.forEach(b => b.disabled = false);
          return;
        }
        
        // Animate the card out and remove
        card.style.transition = 'opacity 0.4s, transform 0.4s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          card.remove();
          // Refresh count
          const remaining = document.querySelectorAll('.claim-card').length;
          document.getElementById('queue-count').textContent = remaining;
          if (remaining === 0) {
            document.getElementById('queue-list').innerHTML = '<p class="admin-empty">No pending claims. The throne rests.</p>';
          }
        }, 400);
      });
    });
  }
  
  document.getElementById('refresh-queue').addEventListener('click', loadQueue);
  
  /* --- Thermometers (manual sync) ----------------------------- */
  
  async function loadThermometers() {
    const list = document.getElementById('thermometer-list');
    list.innerHTML = '<p class="admin-empty">Loading items...</p>';
    
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, slug, display_name, goal_amount, raised_amount, throne_url, display_order')
        .order('display_order');
      
      if (error) {
        console.error('Items load error:', error);
        list.innerHTML = `<p class="admin-empty">Failed to load items: ${escapeHtml(error.message || 'Unknown error')}</p>`;
        return;
      }
      
      if (!data || data.length === 0) {
        list.innerHTML = '<p class="admin-empty">No items found.</p>';
        return;
      }
      
      list.innerHTML = '';
      data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'therm-card';
        card.dataset.itemId = item.id;
        
        const throneLink = item.throne_url
          ? `<a href="${escapeHtml(item.throne_url)}" target="_blank" rel="noopener noreferrer" class="therm-card__throne-link">View on Throne ↗</a>`
          : '';
        
        card.innerHTML = `
          <h3 class="therm-card__name">${escapeHtml(item.display_name)}</h3>
          <p class="therm-card__current">
            Currently: £${Number(item.raised_amount).toLocaleString('en-GB')} 
            / £${Number(item.goal_amount).toLocaleString('en-GB')}
          </p>
          <div class="therm-card__form">
            <input type="number" class="therm-card__input" 
                   placeholder="New total £" 
                   min="0" step="0.01"
                   value="${item.raised_amount}">
            <button type="button" class="therm-card__save" data-action="save">Save</button>
          </div>
          ${throneLink}
        `;
        list.appendChild(card);
      });
      
      // Wire save buttons
      list.querySelectorAll('.therm-card__save').forEach(btn => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('.therm-card');
          const itemId = parseInt(card.dataset.itemId);
          const input = card.querySelector('.therm-card__input');
          const newAmount = parseFloat(input.value);
          
          if (isNaN(newAmount) || newAmount < 0) {
            alert('Please enter a valid amount');
            return;
          }
          
          btn.disabled = true;
          btn.textContent = 'Saving...';
          
          const { data, error } = await supabase.rpc('admin_update_item_raised', {
            p_item_id: itemId,
            p_new_amount: newAmount,
          });
          
          if (error) {
            alert('Failed: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Save';
            return;
          }
          
          btn.classList.add('saved');
          btn.textContent = '✓ Saved';
          setTimeout(() => {
            btn.classList.remove('saved');
            btn.textContent = 'Save';
            btn.disabled = false;
            loadThermometers();
          }, 1500);
        });
      });
    } catch (err) {
      console.error('Thermometers unexpected error:', err);
      list.innerHTML = `<p class="admin-empty">Unexpected error: ${escapeHtml(err.message || 'Unknown')}</p>`;
    }
  }
  
  /* --- Stats --------------------------------------------------- */
  
  async function loadStats() {
    try {
      const [tributeStats, totals] = await Promise.all([
        supabase.from('public_tribute_stats').select('*').single(),
        supabase.from('public_totals').select('*').single(),
      ]);
      
      if (tributeStats.data) {
        document.getElementById('stat-tributers').textContent = 
          (tributeStats.data.total_tributers || 0).toLocaleString('en-GB');
        document.getElementById('stat-qualifying').textContent = 
          '£' + Number(tributeStats.data.total_qualifying_tributes || 0).toLocaleString('en-GB');
      }
      
      if (totals.data) {
        document.getElementById('stat-throne').textContent = 
          '£' + Number(totals.data.total_raised || 0).toLocaleString('en-GB');
        document.getElementById('stat-percent').textContent = 
          (totals.data.overall_percentage || 0).toFixed(1) + '%';
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }
  
  /* --- Link Recovery ------------------------------------------- */
  
  // Wire the search button and Enter key
  document.getElementById('recovery-search-btn')?.addEventListener('click', performRecoverySearch);
  document.getElementById('recovery-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performRecoverySearch();
  });
  
  async function performRecoverySearch() {
    const input = document.getElementById('recovery-input');
    const results = document.getElementById('recovery-results');
    const searchTerm = input.value.trim().replace(/^@/, ''); // Strip leading @ if present
    
    if (!searchTerm) {
      results.innerHTML = '<p class="admin-empty">Please enter a handle to search.</p>';
      return;
    }
    
    results.innerHTML = '<p class="admin-empty">Searching...</p>';
    
    try {
      const { data, error } = await supabase.rpc('admin_search_claims', {
        search_term: searchTerm,
      });
      
      if (error) {
        results.innerHTML = `<p class="admin-empty">Search failed: ${escapeHtml(error.message)}</p>`;
        return;
      }
      
      if (!data || data.length === 0) {
        results.innerHTML = `<p class="admin-empty">No claims found for "${escapeHtml(searchTerm)}". Check spelling or try a partial match.</p>`;
        return;
      }
      
      // Render results
      results.innerHTML = `<p class="recovery-results__count">${data.length} claim${data.length === 1 ? '' : 's'} found</p>`;
      
      data.forEach(claim => {
        const card = document.createElement('div');
        card.className = 'recovery-card';
        
        const statusClass = `recovery-card__status--${claim.status}`;
        const submittedTime = new Date(claim.submitted_at).toLocaleString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        
        const typeBadge = claim.claim_type === 'qualifying'
          ? '<span class="recovery-card__badge recovery-card__badge--qualifying">Qualifying</span>'
          : '<span class="recovery-card__badge recovery-card__badge--contribution">Contribution</span>';
        
        const itemInfo = claim.item_name 
          ? `<div class="recovery-card__row"><span>For altar:</span> <strong>${escapeHtml(claim.item_name)}</strong></div>`
          : '';
        
        const spinUsedInfo = claim.claim_type === 'qualifying'
          ? `<div class="recovery-card__row"><span>Spin used:</span> <strong>${claim.spin_used ? 'Yes' : 'No'}</strong></div>`
          : '';
        
        const proofInfo = claim.proof_url
          ? `<div class="recovery-card__row"><span>Proof:</span> <a href="${escapeHtml(claim.proof_url)}" target="_blank" rel="noopener noreferrer">View ↗</a></div>`
          : '';
        
        const notesInfo = claim.notes
          ? `<div class="recovery-card__notes">"${escapeHtml(claim.notes)}"</div>`
          : '';
        
        const dmMessage = `Goddess sees your tribute. Your spin awaits ✦\n\n${claim.spin_url}\n\nRemember: once you spin, the throne's decree is final.`;
        
        card.innerHTML = `
          <div class="recovery-card__header">
            ${typeBadge}
            <span class="recovery-card__status ${statusClass}">${claim.status.toUpperCase()}</span>
          </div>
          <div class="recovery-card__handle">${escapeHtml(claim.sub_handle)}</div>
          <div class="recovery-card__details">
            <div class="recovery-card__row"><span>Amount:</span> <strong>£${Number(claim.amount).toLocaleString('en-GB')}</strong></div>
            <div class="recovery-card__row"><span>Platform:</span> <strong>${escapeHtml(claim.platform)}</strong></div>
            <div class="recovery-card__row"><span>Submitted:</span> <strong>${submittedTime}</strong></div>
            ${itemInfo}
            ${spinUsedInfo}
            ${proofInfo}
            ${notesInfo}
          </div>
          <div class="recovery-card__url">
            <code>${escapeHtml(claim.spin_url)}</code>
          </div>
          <div class="recovery-card__actions">
            <button type="button" class="recovery-action-btn" data-copy-url="${escapeHtml(claim.spin_url)}">
              📋 Copy Spin URL
            </button>
            <button type="button" class="recovery-action-btn recovery-action-btn--secondary" data-copy-dm="${escapeHtml(dmMessage)}">
              💬 Copy DM Message
            </button>
          </div>
        `;
        
        results.appendChild(card);
      });
      
      // Wire copy buttons
      results.querySelectorAll('.recovery-action-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const text = btn.dataset.copyUrl || btn.dataset.copyDm;
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied';
            btn.classList.add('recovery-action-btn--copied');
            setTimeout(() => {
              btn.textContent = originalText;
              btn.classList.remove('recovery-action-btn--copied');
            }, 1500);
          } catch (err) {
            alert('Copy failed: ' + err.message);
          }
        });
      });
      
    } catch (err) {
      results.innerHTML = `<p class="admin-empty">Unexpected error: ${escapeHtml(err.message)}</p>`;
    }
  }
  
  /* --- Activity Ledger ----------------------------------------- */
  
  let ledgerState = {
    offset: 0,
    pageSize: 50,
    eventTypes: null,
    handle: null,
  };
  
  // Wire ledger controls
  document.getElementById('ledger-apply-btn')?.addEventListener('click', () => {
    loadLedger(true);
  });
  document.getElementById('ledger-more-btn')?.addEventListener('click', () => {
    loadLedger(false);
  });
  document.getElementById('ledger-export-btn')?.addEventListener('click', exportLedgerCSV);
  
  async function loadLedger(reset) {
    const list = document.getElementById('ledger-list');
    const loadMore = document.getElementById('ledger-load-more');
    
    if (reset) {
      ledgerState.offset = 0;
      list.innerHTML = '<p class="admin-empty">Loading activity...</p>';
      loadMore.hidden = true;
      
      // Read current filter values
      const eventFilter = document.getElementById('ledger-event-filter').value;
      const handleFilter = document.getElementById('ledger-handle-filter').value.trim();
      ledgerState.eventTypes = eventFilter ? [eventFilter] : null;
      ledgerState.handle = handleFilter || null;
    }
    
    try {
      const { data, error } = await supabase.rpc('admin_get_ledger', {
        p_limit: ledgerState.pageSize,
        p_offset: ledgerState.offset,
        p_event_types: ledgerState.eventTypes,
        p_handle: ledgerState.handle,
      });
      
      if (error) {
        list.innerHTML = `<p class="admin-empty">Failed to load ledger: ${escapeHtml(error.message)}</p>`;
        return;
      }
      
      if (reset) {
        list.innerHTML = '';
      }
      
      if (!data || data.length === 0) {
        if (reset) {
          list.innerHTML = '<p class="admin-empty">No activity matching those filters.</p>';
        }
        loadMore.hidden = true;
        return;
      }
      
      data.forEach(event => {
        list.appendChild(renderLedgerEvent(event));
      });
      
      ledgerState.offset += data.length;
      
      // Show load more if we got a full page
      loadMore.hidden = data.length < ledgerState.pageSize;
      
    } catch (err) {
      list.innerHTML = `<p class="admin-empty">Unexpected error: ${escapeHtml(err.message)}</p>`;
    }
  }
  
  function renderLedgerEvent(event) {
    const row = document.createElement('div');
    row.className = `ledger-event ledger-event--${event.event_type}`;
    
    const time = new Date(event.event_time).toLocaleString('en-GB', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
    
    const eventInfo = getEventTypeInfo(event.event_type);
    
    let detail = '';
    if (event.event_type === 'spin_completed') {
      detail = `<strong>${escapeHtml(event.sub_handle)}</strong> spun and landed on <em>${escapeHtml(event.spin_landed_on_name)}</em>`;
    } else if (event.event_type.includes('contribution')) {
      const itemPart = event.item_name ? ` for <em>${escapeHtml(event.item_name)}</em>` : '';
      const amountPart = event.amount ? ` £${Number(event.amount).toLocaleString('en-GB')}` : '';
      const platformPart = event.platform ? ` on ${escapeHtml(event.platform)}` : '';
      detail = `<strong>${escapeHtml(event.sub_handle)}</strong>${amountPart}${platformPart}${itemPart}`;
    } else {
      const amountPart = event.amount ? ` £${Number(event.amount).toLocaleString('en-GB')}` : '';
      const platformPart = event.platform ? ` on ${escapeHtml(event.platform)}` : '';
      detail = `<strong>${escapeHtml(event.sub_handle)}</strong>${amountPart}${platformPart}`;
    }
    
    row.innerHTML = `
      <div class="ledger-event__icon">${eventInfo.icon}</div>
      <div class="ledger-event__body">
        <div class="ledger-event__type">${eventInfo.label}</div>
        <div class="ledger-event__detail">${detail}</div>
      </div>
      <div class="ledger-event__time">${time}</div>
    `;
    
    return row;
  }
  
  function getEventTypeInfo(type) {
    const map = {
      qualifying_submitted: { icon: '🪙', label: 'Qualifying tribute submitted' },
      qualifying_approved: { icon: '✓', label: 'Qualifying tribute approved' },
      contribution_submitted: { icon: '👑', label: 'Contribution submitted' },
      contribution_approved: { icon: '✦', label: 'Contribution approved' },
      spin_completed: { icon: '🎰', label: 'Wheel spin' },
      rejected: { icon: '✗', label: 'Claim rejected' },
    };
    return map[type] || { icon: '•', label: type };
  }
  
  async function exportLedgerCSV() {
    const btn = document.getElementById('ledger-export-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Exporting...';
    
    try {
      // Fetch ALL ledger entries (no limit for export)
      const { data, error } = await supabase.rpc('admin_get_ledger', {
        p_limit: 10000,
        p_offset: 0,
        p_event_types: ledgerState.eventTypes,
        p_handle: ledgerState.handle,
      });
      
      if (error) throw error;
      if (!data || data.length === 0) {
        alert('No data to export.');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }
      
      // Build CSV
      const headers = ['Time', 'Event Type', 'Handle', 'Platform', 'Amount', 'Claim Type', 'Status', 'Item', 'Spin Landed On', 'Proof URL', 'Notes'];
      const rows = data.map(e => [
        new Date(e.event_time).toISOString(),
        e.event_type,
        e.sub_handle || '',
        e.platform || '',
        e.amount || '',
        e.claim_type || '',
        e.status || '',
        e.item_name || '',
        e.spin_landed_on_name || '',
        e.proof_url || '',
        (e.notes || '').replace(/"/g, '""'),
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(r => r.map(cell => {
          const s = String(cell);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(','))
      ].join('\n');
      
      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `throne_ledger_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      btn.textContent = '✓ Downloaded';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
      
    } catch (err) {
      alert('Export failed: ' + err.message);
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
  
  /* --- Helpers ------------------------------------------------- */
  
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  
  /* --- Boot ---------------------------------------------------- */
  
  checkAuth();
})();    loadQueue();
    loadThermometers();
    loadStats();
  }
  
  /* --- Login form --------------------------------------------- */
  
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      loginError.textContent = error.message;
      loginError.hidden = false;
      return;
    }
    
    if (data.session) {
      showDashboard(data.session);
    }
  });
  
  /* --- Sign out ------------------------------------------------ */
  
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
  });
  
  /* --- Tabs ---------------------------------------------------- */
  
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tab states
      document.querySelectorAll('.admin-tab').forEach(t => 
        t.classList.toggle('admin-tab--active', t === tab)
      );
      
      // Show/hide sections
      document.getElementById('queue-section').hidden = tabName !== 'queue';
      document.getElementById('thermometers-section').hidden = tabName !== 'thermometers';
      document.getElementById('stats-section').hidden = tabName !== 'stats';
      
      // Refresh data when entering a tab
      if (tabName === 'queue') loadQueue();
      if (tabName === 'thermometers') loadThermometers();
      if (tabName === 'stats') loadStats();
    });
  });
  
  /* --- Queue --------------------------------------------------- */
  
  async function loadQueue() {
    const list = document.getElementById('queue-list');
    list.innerHTML = '<p class="admin-empty">Loading queue...</p>';
    
    const { data, error } = await supabase
      .from('admin_pending_claims')
      .select('*');
    
    if (error) {
      console.error('Queue load error:', error);
      list.innerHTML = '<p class="admin-empty">Failed to load queue. Are you in the admins table?</p>';
      return;
    }
    
    document.getElementById('queue-count').textContent = data.length;
    
    if (data.length === 0) {
      list.innerHTML = '<p class="admin-empty">No pending claims. The throne rests.</p>';
      return;
    }
    
    list.innerHTML = '';
    data.forEach(claim => {
      const card = document.createElement('div');
      card.className = 'claim-card';
      card.dataset.claimId = claim.id;
      
      const proofHtml = claim.proof_url 
        ? `<a href="${escapeHtml(claim.proof_url)}" target="_blank" rel="noopener noreferrer">View Proof ↗</a>`
        : '<span style="opacity:0.5">No proof provided</span>';
      
      const notesHtml = claim.notes 
        ? `<div class="claim-card__notes">"${escapeHtml(claim.notes)}"</div>`
        : '';
      
      const submittedTime = new Date(claim.submitted_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      // Distinguish qualifying tributes from item contributions
      const isContribution = claim.claim_type === 'contribution';
      const typeBadge = isContribution
        ? `<span class="claim-card__type-badge claim-card__type-badge--contribution">Item Contribution</span>`
        : `<span class="claim-card__type-badge claim-card__type-badge--qualifying">Qualifying Tribute</span>`;
      
      const itemFieldHtml = isContribution && claim.item_name
        ? `<div class="claim-card__field">
            <span class="claim-card__field-label">Allocated To</span>
            <span class="claim-card__field-value claim-card__field-value--item">${escapeHtml(claim.item_name)}</span>
          </div>`
        : '';
      
      card.innerHTML = `
        <div class="claim-card__main">
          <div class="claim-card__type-row">${typeBadge}</div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Handle</span>
            <span class="claim-card__field-value">${escapeHtml(claim.sub_handle)}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Platform</span>
            <span class="claim-card__field-value">${escapeHtml(claim.platform)}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Amount</span>
            <span class="claim-card__field-value claim-card__field-value--amount">£${Number(claim.amount).toLocaleString('en-GB')}</span>
          </div>
          ${itemFieldHtml}
          <div class="claim-card__field">
            <span class="claim-card__field-label">Submitted</span>
            <span class="claim-card__field-value">${submittedTime}</span>
          </div>
          <div class="claim-card__field">
            <span class="claim-card__field-label">Proof</span>
            <span class="claim-card__field-value">${proofHtml}</span>
          </div>
          ${notesHtml}
        </div>
        <div class="claim-card__actions">
          <button class="claim-card__btn claim-card__btn--approve" data-action="approve">
            ✓ Approve
          </button>
          <button class="claim-card__btn claim-card__btn--reject" data-action="reject">
            ✗ Reject
          </button>
        </div>
      `;
      list.appendChild(card);
    });
    
    // Wire approve/reject buttons
    list.querySelectorAll('.claim-card__btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.claim-card');
        const claimId = card.dataset.claimId;
        const action = btn.dataset.action;
        
        const buttons = card.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        
        const fnName = action === 'approve' ? 'admin_approve_claim' : 'admin_reject_claim';
        
        const { data: { session } } = await supabase.auth.getSession();
        const reviewer = session?.user?.email || 'admin';
        
        const { data, error } = await supabase.rpc(fnName, {
          claim_id: claimId,
          reviewer: reviewer,
        });
        
        if (error) {
          console.error(action + ' error:', error);
          alert('Failed: ' + error.message);
          buttons.forEach(b => b.disabled = false);
          return;
        }
        
        // Animate the card out and remove
        card.style.transition = 'opacity 0.4s, transform 0.4s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          card.remove();
          // Refresh count
          const remaining = document.querySelectorAll('.claim-card').length;
          document.getElementById('queue-count').textContent = remaining;
          if (remaining === 0) {
            document.getElementById('queue-list').innerHTML = '<p class="admin-empty">No pending claims. The throne rests.</p>';
          }
        }, 400);
      });
    });
  }
  
  document.getElementById('refresh-queue').addEventListener('click', loadQueue);
  
  /* --- Thermometers (manual sync) ----------------------------- */
  
  async function loadThermometers() {
    const list = document.getElementById('thermometer-list');
    list.innerHTML = '<p class="admin-empty">Loading items...</p>';
    
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, slug, display_name, goal_amount, raised_amount, throne_url, display_order')
        .order('display_order');
      
      if (error) {
        console.error('Items load error:', error);
        list.innerHTML = `<p class="admin-empty">Failed to load items: ${escapeHtml(error.message || 'Unknown error')}</p>`;
        return;
      }
      
      if (!data || data.length === 0) {
        list.innerHTML = '<p class="admin-empty">No items found.</p>';
        return;
      }
      
      list.innerHTML = '';
      data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'therm-card';
        card.dataset.itemId = item.id;
        
        const throneLink = item.throne_url
          ? `<a href="${escapeHtml(item.throne_url)}" target="_blank" rel="noopener noreferrer" class="therm-card__throne-link">View on Throne ↗</a>`
          : '';
        
        card.innerHTML = `
          <h3 class="therm-card__name">${escapeHtml(item.display_name)}</h3>
          <p class="therm-card__current">
            Currently: £${Number(item.raised_amount).toLocaleString('en-GB')} 
            / £${Number(item.goal_amount).toLocaleString('en-GB')}
          </p>
          <div class="therm-card__form">
            <input type="number" class="therm-card__input" 
                   placeholder="New total £" 
                   min="0" step="0.01"
                   value="${item.raised_amount}">
            <button type="button" class="therm-card__save" data-action="save">Save</button>
          </div>
          ${throneLink}
        `;
        list.appendChild(card);
      });
      
      // Wire save buttons
      list.querySelectorAll('.therm-card__save').forEach(btn => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('.therm-card');
          const itemId = parseInt(card.dataset.itemId);
          const input = card.querySelector('.therm-card__input');
          const newAmount = parseFloat(input.value);
          
          if (isNaN(newAmount) || newAmount < 0) {
            alert('Please enter a valid amount');
            return;
          }
          
          btn.disabled = true;
          btn.textContent = 'Saving...';
          
          const { data, error } = await supabase.rpc('admin_update_item_raised', {
            p_item_id: itemId,
            p_new_amount: newAmount,
          });
          
          if (error) {
            alert('Failed: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Save';
            return;
          }
          
          btn.classList.add('saved');
          btn.textContent = '✓ Saved';
          setTimeout(() => {
            btn.classList.remove('saved');
            btn.textContent = 'Save';
            btn.disabled = false;
            loadThermometers();
          }, 1500);
        });
      });
    } catch (err) {
      console.error('Thermometers unexpected error:', err);
      list.innerHTML = `<p class="admin-empty">Unexpected error: ${escapeHtml(err.message || 'Unknown')}</p>`;
    }
  }
  
  /* --- Stats --------------------------------------------------- */
  
  async function loadStats() {
    try {
      const [tributeStats, totals] = await Promise.all([
        supabase.from('public_tribute_stats').select('*').single(),
        supabase.from('public_totals').select('*').single(),
      ]);
      
      if (tributeStats.data) {
        document.getElementById('stat-tributers').textContent = 
          (tributeStats.data.total_tributers || 0).toLocaleString('en-GB');
        document.getElementById('stat-qualifying').textContent = 
          '£' + Number(tributeStats.data.total_qualifying_tributes || 0).toLocaleString('en-GB');
      }
      
      if (totals.data) {
        document.getElementById('stat-throne').textContent = 
          '£' + Number(totals.data.total_raised || 0).toLocaleString('en-GB');
        document.getElementById('stat-percent').textContent = 
          (totals.data.overall_percentage || 0).toFixed(1) + '%';
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }
  
  /* --- Helpers ------------------------------------------------- */
  
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  
  /* --- Boot ---------------------------------------------------- */
  
  checkAuth();
})();
