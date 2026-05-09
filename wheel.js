/* ============================================================
   THRONE CAMPAIGN — Wheel
   
   Flow:
     loading -> ready -> spinning -> result (with 3-step contribution flow)
   Or for already-spun token:
     loading -> result (showing previous result)
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  // Brand palette for wheel segments
  const SEGMENT_COLOURS = [
    { fill: '#8b1d3b', text: '#f5d76e' },
    { fill: '#3d0f1c', text: '#e8c547' },
    { fill: '#6b1a30', text: '#f4ebd4' },
    { fill: '#4a1424', text: '#d4a017' },
    { fill: '#a82649', text: '#f4ebd4' },
    { fill: '#2a0a13', text: '#f5d76e' },
    { fill: '#8b1d3b', text: '#e8c547' },
    { fill: '#3d0f1c', text: '#f4ebd4' },
  ];
  
  let state = {
    token: null,
    items: [],
    chosenItem: null,
    selectedAmount: null,
  };
  
  /* --- Helpers ------------------------------------------------- */
  
  function getToken() {
    return new URLSearchParams(window.location.search).get('token');
  }
  
  function showState(stateId) {
    const ids = ['loading-state', 'invalid-state', 'not-ready-state', 'ready-state', 'result-state'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== stateId;
    });
  }
  
  function formatGBP(amount) {
    const num = Number(amount) || 0;
    return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  
  /* --- Wheel SVG generation ------------------------------------ */
  
  function buildWheelSVG(items, targetEl) {
    const size = 480;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const segCount = items.length;
    const segAngle = (2 * Math.PI) / segCount;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    items.forEach((item, idx) => {
      const startAngle = -Math.PI / 2 + segAngle * idx;
      const endAngle = startAngle + segAngle;
      const colour = SEGMENT_COLOURS[idx % SEGMENT_COLOURS.length];
      
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = segAngle > Math.PI ? 1 : 0;
      
      const pathData = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('fill', colour.fill);
      path.setAttribute('stroke', '#d4a017');
      path.setAttribute('stroke-width', '1.5');
      svg.appendChild(path);
      
      const labelAngle = startAngle + segAngle / 2;
      const labelRadius = r * 0.65;
      const lx = cx + labelRadius * Math.cos(labelAngle);
      const ly = cy + labelRadius * Math.sin(labelAngle);
      
      const rotateDeg = (labelAngle * 180) / Math.PI + 90;
      
      const textWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      textWrapper.setAttribute('transform', `translate(${lx}, ${ly}) rotate(${rotateDeg})`);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'Cinzel, serif');
      text.setAttribute('font-size', '15');
      text.setAttribute('font-weight', '600');
      text.setAttribute('letter-spacing', '1');
      text.setAttribute('fill', colour.text);
      
      const words = item.display_name.split(' ');
      if (words.length > 1) {
        words.forEach((word, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', '0');
          tspan.setAttribute('dy', i === 0 ? '-0.4em' : '1.1em');
          tspan.textContent = word;
          text.appendChild(tspan);
        });
      } else {
        text.textContent = item.display_name;
      }
      
      textWrapper.appendChild(text);
      svg.appendChild(textWrapper);
    });
    
    targetEl.innerHTML = '';
    targetEl.appendChild(svg);
  }
  
  /* --- Spin animation (FIXED) ---------------------------------- */
  
  function spinWheelToTarget(wheelEl, targetItemIndex, totalItems) {
    return new Promise((resolve) => {
      const segAngle = 360 / totalItems;
      const segmentCentreFromTop = (segAngle * targetItemIndex) + (segAngle / 2);
      const fullSpins = 6;
      const finalRotation = (fullSpins * 360) - segmentCentreFromTop;
      
      // CRITICAL FIX: ensure starting state is clean before applying transition
      // 1. Remove any transition (so the reset is instant, not animated)
      wheelEl.style.transition = 'none';
      // 2. Reset rotation to 0
      wheelEl.style.transform = 'rotate(0deg)';
      // 3. Force a layout reflow so the browser applies the reset NOW
      void wheelEl.offsetWidth;
      // 4. Apply the long transition and target rotation in next frame
      requestAnimationFrame(() => {
        wheelEl.style.transition = 'transform 5s cubic-bezier(0.15, 0.85, 0.25, 1)';
        wheelEl.style.transform = `rotate(${finalRotation}deg)`;
        
        // Resolve when transition completes
        const onEnd = () => {
          wheelEl.removeEventListener('transitionend', onEnd);
          resolve();
        };
        wheelEl.addEventListener('transitionend', onEnd);
        // Fallback in case transitionend doesn't fire
        setTimeout(resolve, 5500);
      });
    });
  }
  
  /* --- Render: result ------------------------------------------ */
  
  function renderResult(result, isFreshSpin) {
    state.chosenItem = result;
    
    const eyebrowEl = document.getElementById('result-eyebrow');
    const nameEl = document.getElementById('result-item-name');
    const descEl = document.getElementById('result-item-description');
    const progressEl = document.getElementById('result-progress-text');
    
    eyebrowEl.textContent = isFreshSpin ? 'Goddess Has Decided' : 'Your Decree Stands';
    nameEl.textContent = result.item_display_name;
    descEl.textContent = result.item_description || '';
    
    const raised = Number(result.item_raised_amount) || 0;
    const goal = Number(result.item_goal_amount) || 0;
    if (raised >= goal) {
      progressEl.innerHTML = `Altar status: <span>Fully Funded ✦</span>`;
    } else {
      const remaining = goal - raised;
      progressEl.innerHTML = `Altar progress: <span>${formatGBP(raised)} / ${formatGBP(goal)}</span> · ${formatGBP(remaining)} to fill`;
    }
    
    // Build tier buttons
    buildTierButtons(result);
    
    // Wire platform buttons
    wirePlatformButtons(result);
    
    // Wire form
    wireContributionForm(result);
    
    // Wire share buttons
    wireShareButtons(result);
    
    // Clear localStorage now that they've spun
    try {
      localStorage.removeItem('throne_spin_token');
    } catch (e) { /* ignore */ }
    
    showState('result-state');
  }
  
  /* --- Tier buttons ------------------------------------------- */
  
  function buildTierButtons(result) {
    const container = document.getElementById('tier-buttons');
    container.innerHTML = '';
    
    const tiers = [
      { amount: Number(result.tier_low) || 10, label: 'Tribute' },
      { amount: Number(result.tier_mid) || 25, label: 'Devoted', featured: true },
      { amount: Number(result.tier_high) || 50, label: 'Worshipful' },
    ];
    
    tiers.forEach(tier => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tier-btn';
      if (tier.featured) btn.classList.add('tier-btn--featured');
      btn.dataset.amount = tier.amount;
      btn.innerHTML = `
        <span class="tier-btn__amount">${formatGBP(tier.amount)}</span>
        <span class="tier-btn__label">${tier.label}</span>
      `;
      
      btn.addEventListener('click', () => {
        selectAmount(tier.amount);
        // Update visual state
        document.querySelectorAll('.tier-btn').forEach(b => 
          b.classList.toggle('tier-btn--selected', b === btn)
        );
        // Clear custom input
        document.getElementById('custom-amount-input').value = '';
      });
      
      container.appendChild(btn);
    });
    
    // Wire custom amount input
    const customInput = document.getElementById('custom-amount-input');
    customInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (val > 0) {
        selectAmount(val);
        // Clear tier button selection
        document.querySelectorAll('.tier-btn').forEach(b => 
          b.classList.remove('tier-btn--selected')
        );
      }
    });
  }
  
  function selectAmount(amount) {
    state.selectedAmount = amount;
    document.getElementById('selected-amount-text').textContent = formatGBP(amount);
    document.getElementById('selected-amount-display').hidden = false;
    
    // Auto-fill the form amount
    document.getElementById('cf-amount').value = amount;
    
    // Unlock step 2
    const platformBlock = document.getElementById('platform-block');
    platformBlock.classList.add('contribution-block--unlocked');
  }
  
  /* --- Platform buttons ---------------------------------------- */
  
  function wirePlatformButtons(result) {
    document.querySelectorAll('.platform-btn').forEach(btn => {
      const platformKey = btn.dataset.platform;
      const isAnchor = btn.tagName === 'A';
      
      // For Throne specifically, override the href to use the item-specific URL
      if (isAnchor && platformKey === 'throne' && result.item_throne_url) {
        btn.href = result.item_throne_url;
      }
      
      btn.addEventListener('click', (e) => {
        // For "Other" (non-anchor button), we don't navigate anywhere
        // For anchors, let the browser navigate naturally to the URL in href
        // We just track the click for state updates
        
        // Mark as clicked
        document.querySelectorAll('.platform-btn').forEach(b => 
          b.classList.remove('platform-btn--clicked')
        );
        btn.classList.add('platform-btn--clicked');
        
        // Auto-fill the form platform field
        document.getElementById('cf-platform').value = platformKey;
        
        // Unlock step 3
        const confirmBlock = document.getElementById('confirm-block');
        confirmBlock.classList.add('contribution-block--unlocked');
        
        // For "Other" button (non-anchor), prevent default and scroll to form
        if (!isAnchor) {
          e.preventDefault();
          setTimeout(() => {
            confirmBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
        // For anchors, the browser opens the URL in a new tab naturally.
        // The original tab keeps its state (which now shows step 3 unlocked).
      });
    });
  }
  
  /* --- Contribution form --------------------------------------- */
  
  function wireContributionForm(result) {
    const form = document.getElementById('contribution-form');
    const submitBtn = document.getElementById('cf-submit');
    const submitText = submitBtn.querySelector('.cf-submit-text');
    const submitLoader = submitBtn.querySelector('.cf-submit-loader');
    const errorEl = document.getElementById('cf-error');
    
    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    
    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      submitText.hidden = isLoading;
      submitLoader.hidden = !isLoading;
    }
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      
      const handle = document.getElementById('cf-handle').value.trim();
      const platform = document.getElementById('cf-platform').value;
      const amount = parseFloat(document.getElementById('cf-amount').value);
      const proofUrl = document.getElementById('cf-proof').value.trim() || null;
      const notes = document.getElementById('cf-notes').value.trim() || null;
      
      if (!handle) { showError('Please enter your handle'); return; }
      if (!platform) { showError('Please select the platform you sent it on'); return; }
      if (!amount || amount <= 0) { showError('Please enter a valid amount'); return; }
      
      setLoading(true);
      
      try {
        const { data, error } = await supabase.rpc('submit_item_contribution', {
          p_sub_handle: handle,
          p_platform: platform,
          p_amount: amount,
          p_item_id: result.item_id,
          p_spin_token: state.token,
          p_proof_url: proofUrl,
          p_notes: notes,
        });
        
        if (error) throw error;
        
        // Show success state
        document.getElementById('amount-block').hidden = true;
        document.getElementById('platform-block').hidden = true;
        document.getElementById('confirm-block').hidden = true;
        
        const successBlock = document.getElementById('success-block');
        document.getElementById('success-item-name').textContent = result.item_display_name;
        successBlock.hidden = false;
        successBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
      } catch (err) {
        console.error('Contribution submit error:', err);
        showError(err.message || 'Something went wrong. Please try again.');
        setLoading(false);
      }
    });
  }
  
  /* --- Share buttons ------------------------------------------- */
  
  function wireShareButtons(result) {
    const shareText = `Goddess @SophiaTruee has decreed: I shall fund Her ${result.item_display_name} 👑`;
    const shareUrl = window.location.origin + window.location.pathname.replace('wheel.html', '');
    
    document.getElementById('share-twitter').href = 
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    
    const copyBtn = document.getElementById('copy-link-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        copyBtn.classList.add('copied');
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = 'Copy Campaign Link';
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  }
  
  /* --- Boot logic ---------------------------------------------- */
  
  async function boot() {
    state.token = getToken();
    
    if (!state.token) {
      showState('invalid-state');
      return;
    }
    
    try {
      // Check claim status
      const { data: claimRows, error: claimErr } = await supabase.rpc('get_claim_by_token', {
        claim_token: state.token,
      });
      
      if (claimErr) throw claimErr;
      
      const claim = Array.isArray(claimRows) && claimRows.length > 0 ? claimRows[0] : null;
      
      if (!claim) {
        showState('invalid-state');
        return;
      }
      
      if (claim.status === 'rejected') {
        showState('invalid-state');
        return;
      }
      
      if (claim.status !== 'approved') {
        showState('not-ready-state');
        return;
      }
      
      // If already spun, show the previous result
      if (claim.spin_used) {
        const { data: resultRows, error: resErr } = await supabase.rpc('get_spin_result', {
          claim_token: state.token,
        });
        
        if (resErr) throw resErr;
        
        const result = Array.isArray(resultRows) && resultRows.length > 0 ? resultRows[0] : null;
        if (!result) {
          showState('invalid-state');
          return;
        }
        
        // Need tier amounts which aren't in get_spin_result - fetch from items
        const { data: itemData } = await supabase
          .from('public_items')
          .select('*')
          .eq('id', result.item_id)
          .single();
        
        if (itemData) {
          result.tier_low = itemData.tier_low;
          result.tier_mid = itemData.tier_mid;
          result.tier_high = itemData.tier_high;
        }
        
        renderResult(result, false);
        return;
      }
      
      // Approved + not yet spun
      const { data: items, error: itemsErr } = await supabase
        .from('public_items')
        .select('*')
        .order('display_order');
      
      if (itemsErr) throw itemsErr;
      
      state.items = items;
      
      // Build the wheel
      buildWheelSVG(items, document.getElementById('wheel'));
      
      showState('ready-state');
      
      // Wire spin button
      document.getElementById('spin-button').addEventListener('click', performSpin);
      
    } catch (err) {
      console.error('Boot error:', err);
      showState('invalid-state');
    }
  }
  
  /* --- Perform spin -------------------------------------------- */
  
  async function performSpin() {
    const btn = document.getElementById('spin-button');
    btn.disabled = true;
    
    try {
      // Server picks the winner and marks spin used
      const { data: spinRows, error: spinErr } = await supabase.rpc('perform_spin', {
        claim_token: state.token,
      });
      
      if (spinErr) throw spinErr;
      
      const result = Array.isArray(spinRows) && spinRows.length > 0 ? spinRows[0] : null;
      if (!result) throw new Error('No result returned');
      
      // Find target index in our wheel
      const targetIndex = state.items.findIndex(i => i.id === result.item_id);
      if (targetIndex === -1) {
        // Shouldn't happen
        // Fetch tier amounts since perform_spin doesn't return them
        const { data: itemData } = await supabase
          .from('public_items')
          .select('*')
          .eq('id', result.item_id)
          .single();
        if (itemData) {
          result.tier_low = itemData.tier_low;
          result.tier_mid = itemData.tier_mid;
          result.tier_high = itemData.tier_high;
        }
        renderResult(result, true);
        return;
      }
      
      // Animate the wheel to land on the target
      const wheelEl = document.getElementById('wheel');
      await spinWheelToTarget(wheelEl, targetIndex, state.items.length);
      
      // Brief pause for atmosphere
      await new Promise(r => setTimeout(r, 800));
      
      // Fetch tier amounts for the chosen item
      const chosenItem = state.items.find(i => i.id === result.item_id);
      if (chosenItem) {
        result.tier_low = chosenItem.tier_low;
        result.tier_mid = chosenItem.tier_mid;
        result.tier_high = chosenItem.tier_high;
      }
      
      renderResult(result, true);
      
    } catch (err) {
      console.error('Spin failed:', err);
      btn.disabled = false;
      alert('The throne could not process your spin: ' + (err.message || 'Unknown error'));
    }
  }
  
  /* --- Boot ---------------------------------------------------- */
  
  boot();
})();
