const SHEET_ID = "1Www2I2wtdxsYyRJTBkaln_Ax5eRECZkBEZ04BXQ9B7I";
const DRIVE_FOLDER_ID = "1Y5L0sDgIQHHS2lZAYjL2z_zX3Imq1t5f";

let projectOptions = '';

const form = document.getElementById("reimbursementForm");
form.classList.add('loading');

// Add / remove dynamic expense items
const itemsContainer = document.getElementById('items');
const addItemBtn = document.getElementById('addItemBtn');

addItemBtn.addEventListener('click', () => {
    const idx = itemsContainer.querySelectorAll('.expense-item').length;
    const prototype = itemsContainer.querySelector('.expense-item');
    const clone = prototype.cloneNode(true);
    clone.dataset.index = idx;
    // clear values
    clone.querySelectorAll('input,textarea').forEach(el => {
        el.value = '';
    });
    // Reset Select2 on clone
    $(clone).find('.select2-container').remove();
    $(clone).find('.project2').removeClass('select2-hidden-accessible').removeAttr('data-select2-id').show();
    clone.querySelector('.project2').innerHTML = '<option value=""></option>' + projectOptions;
    clone.querySelector('.remove-item').style.display = 'inline-block';
    $(clone).find('.project2').select2({
        placeholder: 'Select...',
        allowClear: false,
        width: '100%'
    });
    itemsContainer.appendChild(clone);
});

// Automatically focus the search field when any Select2 dropdown opens
$(document).on('select2:open', () => {
    const searchField = document.querySelector('.select2-container--open .select2-search__field');
    if (searchField) {
        searchField.focus();
    }
});

itemsContainer.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('remove-item')) {
        const item = e.target.closest('.expense-item');
        if (item) item.remove();
    }
});

// Amount formatting for dynamic inputs (delegated)
$(document).on("keyup", ".amount", function (event) {
    var selection = window.getSelection().toString();
    if (selection !== '') return;
    if ($.inArray(event.keyCode, [38, 40, 37, 39]) !== -1) return;

    var $this = $(this);
    var input = $this.val().replace(/[\D\s\._\-]+/g, "");
    input = input ? parseInt(input, 10) : 0;
    $this.val(function () {
        return input === 0 ? "" : "Rp" + input.toLocaleString("id-ID");
    });
});

//LOAD EVERYTHINGGG
async function loadEverything() {
    try {
        const json = await fetch('/init', { method: 'GET'}).then(res => res.json());
        // const json = await fetch('./testInit.json').then(res => res.json());

        //LOAD DROPDOWNS
        const values = json.valueRanges[1].values || [];
        let approverHTML = "", requesterHTML = "", projectHTML = "";
        for (const row of values) {
            const [approver, requester, , project] = row;

            if (approver)  approverHTML  += `<option value="${approver}">${approver}</option>`;
            if (requester) requesterHTML += `<option value="${requester}">${requester}</option>`;
            if (project)   projectHTML   += `<option value="${project}">${project}</option>`;
        }
        projectOptions = projectHTML;

        document.getElementById("requester").innerHTML += requesterHTML;
        document.getElementById("approver").innerHTML  += approverHTML;
        document.querySelectorAll('.project2').forEach(sel => sel.innerHTML += projectOptions);
        
        $('#requester, #approver, .project2').select2({
            placeholder: 'Select...',
            allowClear: false,
            width: '100%'
        });
        $('#requester, #approver, .project2')
            .prop('disabled', false)
            .trigger('change');
        form.classList.remove('loading');
        //LOAD TABLE
        const rows = json.valueRanges[0].values || [];
        const tbody = document.querySelector('#reimbursementTable tbody');
        tbody.innerHTML = '';
        let temphtml = '';
        for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i];
            temphtml += `
            <tr>
              <td>${r[1] || ''}</td>
              <td>${r[2] || ''}</td>
              <td>${r[3] || ''}</td>
              <td>${r[4] || ''}</td>
              <td><span class="approvalStatus ${(r[11] || '').toLowerCase()}">${r[11] || ''}</span></td>
            </tr>`;
        }
        tbody.innerHTML = temphtml;

        $('#reimbursementTable').DataTable({
            responsive: true,
            autoWidth: false,
            order: [],
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            columnDefs: [
                { className: 'td-text-center', targets: -1 }
            ],
            language: {
                search: "🔍 Search",
                lengthMenu: "Show _MENU_",
                info: "Showing _START_ to _END_ of _TOTAL_ entries"
            }
        });
    } catch (err) {
        document.getElementById('status').textContent = "❌ Error loading " + err.message;
    }
}
loadEverything()

//SUBMITTTTTTT
$("#reimbursementForm").on("submit", async function (e) {
    e.preventDefault();
    
    form.classList.add('loading');
    const statusEl = document.getElementById("status");
    statusEl.textContent = "⏳ Uploading...";
    const formEl = e.target;
    const requesterVal = formEl.requester.value;
    const approverVal = formEl.approver.value;
    
    const fd = new FormData();

    fd.append("requester", $("#requester").val());
    fd.append("approver", $("#approver").val());
    fd.append("idemKey", crypto.randomUUID())

    const items = [];

    $("#items .expense-item").each(function () {
        const $item = $(this);
        const idx = $item.data("index");

        // Append files to FormData as: receipt_0, invoice_0
        const itemFiles = $item.find(".itemFiles")[0].files;
        console.log("Item files for index", idx, itemFiles);
        for(const f of itemFiles) {
            fd.append(`items[${idx}]files`, f);
        }

        items.push({
            project: $item.find(".project2").val(),
            expenseDate: $item.find(".expenseDate").val(),
            description: $item.find(".description").val(),
            amount: Number(String($item.find(".amount").val()).replace(/[^\d-]/g, '')) || 0,
            index: idx,
            fileCount: itemFiles.length
        });
    });

    fd.append("items", JSON.stringify(items));
    const resp = await fetch("/postreimburse", {
        method: "POST",
        body: fd,
    });
    const json = await resp.json();
    console.log(json);
    
    statusEl.innerHTML = "✅ Submitted successfully!";
    // reset form but keep selects
    formEl.reset();
    form.classList.remove('loading');
    // remove additional items except first
    const allItems = itemsContainer.querySelectorAll('.expense-item');
    allItems.forEach((n, i) => {
      if (i > 0) n.remove();
      else {
        n.querySelectorAll('input,textarea').forEach(el => el.value = '');
      }
    });

    // restore select2 values (keeps the chosen ones)
    $('#requester').val(requesterVal).trigger('change');
    $('#approver').val(approverVal).trigger('change');

    // refresh table (simple reload)
    const table = $('#reimbursementTable').DataTable();
    table.destroy();
    
    try {
        const json = await fetch('/init', { method: 'GET'}).then(res => res.json());
        //LOAD TABLE
        const rows = json.valueRanges[0].values || [];
        const tbody = document.querySelector('#reimbursementTable tbody');
        tbody.innerHTML = '';
        let temphtml = '';
        for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i];
            temphtml += `
            <tr>
              <td>${r[1] || ''}</td>
              <td>${r[2] || ''}</td>
              <td>${r[3] || ''}</td>
              <td>${r[4] || ''}</td>
              <td><span class="approvalStatus ${(r[11] || '').toLowerCase()}">${r[11] || ''}</span></td>
            </tr>`;
        }
        tbody.innerHTML = temphtml;

        $('#reimbursementTable').DataTable({
            responsive: true,
            autoWidth: false,
            order: [],
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            columnDefs: [
                { className: 'td-text-center', targets: -1 }
            ],
            language: {
                search: "🔍 Search",
                lengthMenu: "Show _MENU_",
                info: "Showing _START_ to _END_ of _TOTAL_ entries"
            }
        });
    } catch (err) {
        document.getElementById('status').textContent = "❌ Error loading " + err.message;
    }
});