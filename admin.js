/* ============================================================
   THRONE ADMIN — Pending claims management
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
    const { data } = await supabase.auth.getSession();
    if (data && data.session) {
      showDashboard(data.session);
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
    document.getElementById('user-email').textContent = session.user.email || '';
    loadQueue();
    loadThermometers();
    loadStats();
  }
  
  /* --- Login form -------------------------------------------- */
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.hidden = true;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    
    if (error) {
      errorEl.textContent = error.message || 'Sign in failed';
      errorEl.hidden = false;
      return;
    }
    
    showDashboard(data.session);
  });
  
  /* --- Sign out -------------------------------------------- */
  
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });
  
  /* --- Tabs -------------------------------------------- */
  
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.admin-tab').forEach(t => 
        t.classList.toggle('admin-tab--active', t === tab)
      );
      
      document.getElementById('queue-section').hidden = tabName !== 'queue';
      document.getElementById('thermometers-section').hidden = tabName !== 'thermometers';
      document.getElementById('stats-section').hidden = tabName !== 'stats';
      
      if (tabName === 'queue') loadQueue();
      if (tabName === 'thermometers') loadThermometers();
      if (tabName === 'stats') loadStats();
    });
  });
  
  /* --- Queue (Pending Claims) -------------------------------- */
  
  document.getElementById('refresh-queue').addEventListener('click', loadQueue);
  
  async function loadQueue() {
    const list = document.getElementById('queue-list');
    const countEl = document.getElementById('queue-count');
    list.innerHTML = '<p class="admin-empty">Loading queue...</p>';
    
    const { data, error } = await supabase
      .from('admin_pending_claims')
      .select('*');
    
    if (error) {
      list.innerHTML = '<p class="admin-empty">Failed to load queue. Are you in the admins table?</p>';
      countEl.textContent = '0';
      return;
    }
    
    countEl.textContent = String(data ? data.length : 0);
    
    if (!data || data.length === 0) {
      list.innerHTML = '<p class="admin-empty">No pending claims. The throne rests.</p>';
      return;
    }
    
    list.innerHTML = '';
    data.forEach(claim => {
      const card = document.createElement('div');
      card.className = 'claim-card';
      card.dataset.claimId = claim.id;
      
      const proofHtml = claim.proof_url 
        ? '<a href="' + escapeHtml(claim.proof_url) + '" target="_blank" rel="noopener noreferrer">View Proof &#8599;</a>'
        : '<span style="opacity:0.5">No proof provided</span>';
      
      const notesHtml = claim.notes 
        ? '<div class="claim-card__notes">"' + escapeHtml(claim.notes) + '"</div>'
        : '';
      
      const submittedTime = new Date(claim.submitted_at).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      const isContribution = claim.claim_type === 'contribution';
      const typeBadge = isContribution
        ? '<span class="claim-card__type-badge claim-card__type-badge--contribution">Item Contribution</span>'
        : '<span class="claim-card__type-badge claim-card__type-badge--qualifying">Qualifying Tribute</span>';
      
      const itemFieldHtml = (isContribution && claim.item_name)
        ? '<div class="claim-card__field"><span class="claim-card__field-label">Allocated To</span><span class="claim-card__field-value claim-card__field-value--item">' + escapeHtml(claim.item_name) + '</span></div>'
        : '';
      
      card.innerHTML = 
        '<div class="claim-card__main">' +
          '<div class="claim-card__type-row">' + typeBadge + '</div>' +
          '<div class="claim-card__field">' +
            '<span class="claim-card__field-label">Handle</span>' +
            '<span class="claim-card__field-value">' + escapeHtml(claim.sub_handle) + '</span>' +
          '</div>' +
          '<div class="claim-card__field">' +
            '<span class="claim-card__field-label">Platform</span>' +
            '<span class="claim-card__field-value">' + escapeHtml(claim.platform) + '</span>' +
          '</div>' +
          '<div class="claim-card__field">' +
            '<span class="claim-card__field-label">Amount</span>' +
            '<span class="claim-card__field-value claim-card__field-value--amount">&pound;' + Number(claim.amount).toLocaleString('en-GB') + '</span>' +
          '</div>' +
          itemFieldHtml +
          '<div class="claim-card__field">' +
            '<span class="claim-card__field-label">Submitted</span>' +
            '<span class="claim-card__field-value">' + submittedTime + '</span>' +
          '</div>' +
          '<div class="claim-card__field">' +
            '<span class="claim-card__field-label">Proof</span>' +
            '<span class="claim-card__field-value">' + proofHtml + '</span>' +
          '</div>' +
          notesHtml +
        '</div>' +
        '<div class="claim-card__actions">' +
          '<button class="claim-card__btn claim-card__btn--approve" data-action="approve">&#x2713; Approve</button>' +
          '<button class="claim-card__btn claim-card__btn--reject" data-action="reject">&#x2717; Reject</button>' +
        '</div>';
      
      list.appendChild(card);
    });
    
    // Wire approve/reject buttons
    list.querySelectorAll('.claim-card__btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.claim-card');
        const claimId = card.dataset.claimId;
        const action = btn.dataset.action;
        
        btn.disabled = true;
        
        const fnName = action === 'approve' ? 'admin_approve_claim' : 'admin_reject_claim';
        const { data: success, error: err } = await supabase.rpc(fnName, {
          claim_id: claimId,
        });
        
        if (err) {
          alert('Failed: ' + err.message);
          btn.disabled = false;
          return;
        }
        
        // Animate out
        card.style.transition = 'all 0.4s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
          card.remove();
          // Update count
          const remaining = document.querySelectorAll('.claim-card').length;
          document.getElementById('queue-count').textContent = String(remaining);
          if (remaining === 0) {
            document.getElementById('queue-list').innerHTML = 
              '<p class="admin-empty">No pending claims. The throne rests.</p>';
          }
        }, 400);
      });
    });
  }
  
  /* --- Thermometers (manual sync) ---------------------------- */
  
  async function loadThermometers() {
    const list = document.getElementById('thermometer-list');
    list.innerHTML = '<p class="admin-empty">Loading items...</p>';
    
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, slug, display_name, goal_amount, raised_amount, throne_url, display_order')
        .order('display_order');
      
      if (error) {
        list.innerHTML = '<p class="admin-empty">Failed to load items: ' + escapeHtml(error.message || 'Unknown error') + '</p>';
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
          ? '<a href="' + escapeHtml(item.throne_url) + '" target="_blank" rel="noopener noreferrer" class="therm-card__throne-link">View on Throne &#8599;</a>'
          : '';
        
        card.innerHTML = 
          '<h3 class="therm-card__name">' + escapeHtml(item.display_name) + '</h3>' +
          '<p class="therm-card__current">Currently: &pound;' + Number(item.raised_amount).toLocaleString('en-GB') + 
            ' / &pound;' + Number(item.goal_amount).toLocaleString('en-GB') + '</p>' +
          '<div class="therm-card__form">' +
            '<input type="number" class="therm-card__input" placeholder="New total &pound;" min="0" step="0.01" value="' + item.raised_amount + '">' +
            '<button type="button" class="therm-card__save" data-action="save">Save</button>' +
          '</div>' +
          throneLink;
        
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
          btn.textContent = '\u2713 Saved';
          setTimeout(() => {
            btn.classList.remove('saved');
            btn.textContent = 'Save';
            btn.disabled = false;
            loadThermometers();
          }, 1500);
        });
      });
    } catch (err) {
      list.innerHTML = '<p class="admin-empty">Unexpected error: ' + escapeHtml(err.message || 'Unknown') + '</p>';
    }
  }
  
  /* --- Stats -------------------------------------------- */
  
  async function loadStats() {
    try {
      const { data: stats } = await supabase
        .from('public_tribute_stats')
        .select('*')
        .single();
      
      const { data: items } = await supabase
        .from('items')
        .select('raised_amount, goal_amount');
      
      const totalRaised = (items || []).reduce((sum, i) => sum + Number(i.raised_amount), 0);
      const totalGoal = (items || []).reduce((sum, i) => sum + Number(i.goal_amount), 0);
      const percent = totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0;
      
      document.getElementById('stat-tributers').textContent = stats ? stats.total_tributers : '0';
      document.getElementById('stat-qualifying').textContent = stats 
        ? '\u00a3' + Number(stats.total_qualifying_tributes).toLocaleString('en-GB') 
        : '\u00a30';
      document.getElementById('stat-throne').textContent = '\u00a3' + totalRaised.toLocaleString('en-GB');
      document.getElementById('stat-percent').textContent = percent + '%';
    } catch (err) {
      console.error('Stats load error:', err);
    }
  }
  
  /* --- Helpers ----------------------------------------- */
  
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  
  /* --- Boot -------------------------------------------- */
  
  checkAuth();
})();
