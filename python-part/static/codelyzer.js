document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const fileInputLabel = document.querySelector('.file-input-label');
  const fileNameDisplay = document.getElementById('fileName');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const buttonText = document.getElementById('buttonText');
  const textInput = document.getElementById('textInput');
  

  // Handle drag and drop for file input
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    fileInputLabel.classList.add('highlight');
  }

  function unhighlight() {
    fileInputLabel.classList.remove('highlight');
  }

  fileInputLabel.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      fileInput.files = files;
      updateFileNameDisplay();
    }
  }

  fileInput.addEventListener('change', updateFileNameDisplay);

  function updateFileNameDisplay() {
    if (fileInput.files.length > 0) {
      fileNameDisplay.textContent = fileInput.files[0].name;
    } else {
      fileNameDisplay.textContent = '';
    }
  }

  // Clear file input when text area gets content
  textInput.addEventListener('input', function() {
    if (this.value.trim() !== '' && fileInput.files.length > 0) {
      fileInput.value = '';
      fileNameDisplay.textContent = '';
    }
  });
});

async function submitSummary() {
  const textInput = document.getElementById('textInput').value.trim();
  const fileInput = document.getElementById('fileInput').files[0];
  const output = document.getElementById('output');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const buttonText = document.getElementById('buttonText');

  // Show loading state
  summarizeBtn.disabled = true;
  loadingSpinner.style.display = 'block';
  buttonText.textContent = 'Processing...';
  output.textContent = '';

  let payload = {};
  try {
    if (fileInput) {
      const fileType = fileInput.name.split('.').pop().toLowerCase();
      const base64 = await fileToBase64(fileInput);

      if (fileType === 'pdf') {
        payload = { input_type: 'pdf', content: base64 };
      } else if (fileType === 'docx') {
        payload = { input_type: 'docx', content: base64 };
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
      }
    } else if (textInput) {
      payload = { input_type: 'text', content: textInput };
    } else {
      throw new Error('Please enter text or upload a file.');
    }

    const res = await fetch('http://localhost:3000/codelyzer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to get summary');
    }

    const data = await res.json();
    const htmlData = marked.parse(data.summary || '');
    console.log(htmlData)
  output.innerHTML = htmlData || '<em>No summary generated.</em>';
    
  } catch (err) {
    output.innerHTML = `<div class="error">Error: ${err.message}</div>`;
    console.error('Error:', err);
  } finally {
    // Hide loading state
    summarizeBtn.disabled = false;
    loadingSpinner.style.display = 'none';
    buttonText.textContent = 'Summarize';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}