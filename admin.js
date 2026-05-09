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
    
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('display_order');
    
    if (error) {
      console.error('Items load error:', error);
      list.innerHTML = '<p class="admin-empty">Failed to load items.</p>';
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
