const { createApp } = Vue

createApp({
  delimiters: ['[%', '%]'],
  data() {
    return {
        id: '',
        payment_data: {},
        gateway: '',
        showDiv: false
    }
  },
  methods: {
    payWithPaystack(){
        let me = this;
        let handler = PaystackPop.setup({
            key: me.payment_data.public_key, // Replace with your public key
            amount: me.payment_data.grand_total * 100,
            // ref: me.payment_data.name+'_'+Math.floor((Math.random() * 1000000000) + 1), // generates a pseudo-unique reference. Please replace with a reference you generated. Or remove the line entirely so our API will generate one for you
            currency: me.payment_data.currency,
            email: me.payment_data.email_to,
            metadata: {
                reference_doctype:me.payment_data.reference_doctype, 
                reference_name:me.payment_data.reference_name,
                payment_request:me.payment_data.name},
            // label: "Optional string that replaces customer email"
            onClose: function(){
                alert('Payment Terminated.');
                // Check if a custom redirect URL is provided
                if (me.payment_data.custom_redirect) {
                    window.location.href = me.payment_data.custom_redirect;
                }
            },
            callback: function(response){
                // console.log(response)
                frappe.call({
                    type: "POST",
                    method: "frappe_paystack.www.paystack_checkout.index.verify_transaction",
                    args:response,
                    callback: function(r) {
                        $('#paymentBTN').hide();
                        // Check if this is a valid payment entry in ERPNext
                        frappe.call({
                            type: "GET",
                            method: "frappe.client.get",
                            args: {
                                doctype: "Payment Entry",
                                filters: {
                                    reference_no: me.payment_data.name
                                }
                            },
                            callback: function(paymentResult) {
                                if (paymentResult.message) {
                                    // Valid payment entry found
                                    Swal.fire({
                                        title: 'Payment Successful',
                                        text: 'Your payment was processed successfully.',
                                        icon: 'success',
                                        showCancelButton: true,
                                        confirmButtonText: 'View Payment',
                                        cancelButtonText: 'Continue',
                                        timer: 10000,
                                        timerProgressBar: true,
                                    }).then((result) => {
                                        if (result.isConfirmed) {
                                            // Redirect to payment entry
                                            window.location.href = `printview?doctype=Payment%20Entry&name=${paymentResult.message.name}`;
                                        } else {
                                            if (me.payment_data.custom_redirect) {
                                                window.location.href = me.payment_data.custom_redirect;
                                            } else {
                                                window.location.href = '/dashboard';
                                            }
                                        }
                                    });
                                } else {
                                    // Payment entry not found yet, but payment was successful
                                    Swal.fire({
                                        title: 'Processing Payment',
                                        text: 'Your payment was successful but is still being processed. You will receive a confirmation shortly.',
                                        icon: 'info',
                                        confirmButtonText: 'OK',
                                    }).then(() => {
                                        if (me.payment_data.custom_redirect) {
                                            window.location.href = me.payment_data.custom_redirect;
                                        } else {
                                            window.location.href = '/dashboard';
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
                $('#paymentBTN').hide();
                // Swal.fire({
                //     title: 'Successful',
                //     text: 'Your payment was successful, we will issue you receipt shortly.',
                //     icon: 'success',
                //     timer: 5000, // Auto-close after 3 seconds
                //     didClose: () => {
                //         // Check if a custom redirect URL is provided
                //         if (me.payment_data.custom_redirect) {
                //             window.location.href = me.payment_data.custom_redirect;
                //         // } else {
                //             // Default fallback redirect (e.g., invoice or home page)
                //         //     window.location.href = `/app/`;
                //         }
                //     }
                // })


                // Show success message with View Payment button
                // Swal.fire({
                //     title: 'Successful',
                //     text: 'Your payment was successful, we will issue you receipt shortly.',
                //     icon: 'success',
                //     showCancelButton: true,
                //     confirmButtonText: 'View Payment',
                //     cancelButtonText: 'Continue',
                //     timer: 10000, // Increased timer to allow user interaction
                //     timerProgressBar: true,
                //     didClose: () => {
                //         if (me.payment_data.custom_redirect) {
                //             window.location.href = me.payment_data.custom_redirect;
                //         }
                //     }
                // }).then((result) => {
                //     if (result.isConfirmed) {
                //         // Redirect to payment details page
                //         window.location.href = `/app/payment-entry/${me.payment_response.reference}`;
                //     } else if (result.dismiss === Swal.DismissReason.cancel || result.dismiss === Swal.DismissReason.timer) {
                //         // Redirect to custom URL or fallback
                //         if (me.payment_data.custom_redirect) {
                //             window.location.href = me.payment_data.custom_redirect;
                //         }
                //     }
                // })

            }
        });

        handler.openIframe();
    },
    getData(){
        document.addEventListener('DOMContentLoaded', () => {
            // handle the click event
            const urlParams = new URLSearchParams(window.location.search);
            this.reference_doctype = urlParams.get('reference_doctype');
            this.reference_docname = urlParams.get('reference_docname');

            if (!this.reference_docname && !this.reference_doctype){
                Swal.fire(
                    'Invalid',
                    'Your payment link is invalid',
                    'warning'
                )
                me.payment_data = {}
                return window.location.href = `/me`;
            } else {
                let me =  this;
                frappe.call({
                    type: "POST",
                    method: "frappe_paystack.www.paystack_checkout.index.get_payment_request",
                    args:{
                        reference_doctype:me.reference_doctype,
                        reference_docname:me.reference_docname
                    },
                    callback: function(r) {
                        // code snippet
                        // console.log(r)
                        if(r.message.error){
                            Swal.fire(
                                'Error',
                                r.message.error,
                                'warning'
                            )
                            me.payment_data = {}
                            me.showDiv = false;
                            return window.location.href = `/dashboard`;
                        } else {
                            me.payment_data = r.message;
                            me.payWithPaystack();
                            me.showDiv = true;
                        }
                    }
                });
            }
        });
        
    },
    formatCurrency(amount, currency){
        if(currency){
            return Intl.NumberFormat('en-US', {currency:currency, style:'currency'}).format(amount);
        } else {
            return Intl.NumberFormat('en-US').format(amount);
        }
    }
  },
  mounted(){
    this.getData();
  }
}).mount('#app')
