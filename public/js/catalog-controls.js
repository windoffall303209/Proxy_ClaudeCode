document.addEventListener('DOMContentLoaded', () => {
    const toolbarForms = document.querySelectorAll('.catalog-toolbar__form');

    toolbarForms.forEach((form) => {
        if (!form || form.dataset.catalogControlsBound === 'true') {
            return;
        }

        form.dataset.catalogControlsBound = 'true';

        const pageInput = form.querySelector('input[name="page"]');
        const controls = form.querySelectorAll('select[data-catalog-control]');

        controls.forEach((control) => {
            control.addEventListener('change', () => {
                if (pageInput) {
                    pageInput.value = '1';
                }

                form.requestSubmit ? form.requestSubmit() : form.submit();
            });
        });
    });
});
