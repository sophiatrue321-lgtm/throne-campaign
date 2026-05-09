/* ============================================================
   THRONE CAMPAIGN — Claim Form
   ============================================================ */

(function() {
  'use strict';
  
  const config = window.THRONE_CONFIG;
  const supabase = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY
  );
  
  const form = document.getElementById('claim-form');
  const submitBtn = document.getElementById('submit-btn');
  const submitText = submitBtn.querySelector('.form__submit-text');
  const submitLoader = submitBtn.querySelector('.form__submit-loader');
  const errorEl = document.getElementById('form-error');
  
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  
  function hideError() {
    errorEl.hidden = true;
  }
  
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitText.hidden = isLoading;
    submitLoader.hidden = !isLoading;
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const handle = document.getElementById('handle').value.trim();
    const platform = document.getElementById('platform').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const proofUrl = document.getElementById('proof_url').value.trim() || null;
    const notes = document.getElementById('notes').value.trim() || null;
    
    // Client-side validation
    if (!handle) {
      showError('Please enter your handle');
      return;
    }
    if (!platform) {
      showError('Please select the platform you tributed on');
      return;
    }
    if (!amount || amount < 10) {
      showError('Minimum tribute is £10');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('submit_tribute_claim', {
        p_sub_handle: handle,
        p_platform: platform,
        p_amount: amount,
        p_proof_url: proofUrl,
        p_notes: notes,
      });
      
      if (error) {
        throw error;
      }
      
      const token = data;
      const spinUrl = `${window.location.origin}${window.location.pathname.replace('claim.html', '')}spin.html?token=${encodeURIComponent(token)}`;
      
      // Save to localStorage for "resume" feature
      try {
        localStorage.setItem('throne_spin_token', token);
      } catch (e) {
        // localStorage might be disabled - not critical
      }
      
      // Show success state
      document.getElementById('form-section').hidden = true;
      const successSection = document.getElementById('success-section');
      successSection.hidden = false;
      
      document.getElementById('spin-url').textContent = spinUrl;
      document.getElementById('goto-spin').href = `spin.html?token=${encodeURIComponent(token)}`;
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (err) {
      console.error('Submit error:', err);
      const message = err.message || 'Something went wrong. Please try again.';
      showError(message);
      setLoading(false);
    }
  });
  
  // Copy button
  const copyBtn = document.getElementById('copy-btn');
  copyBtn.addEventListener('click', async () => {
    const url = document.getElementById('spin-url').textContent;
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋 Copy Link';
      }, 2000);
    } catch (err) {
      // Fallback: select the text
      const range = document.createRange();
      range.selectNode(document.getElementById('spin-url'));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
  });
})();
