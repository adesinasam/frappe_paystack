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
            },
            callback: function(response){
                console.log(response)
                frappe.call({
                    type: "POST",
                    method: "frappe_paystack.www.paystack_checkout.index.verify_transaction",
                    args:response,
                    callback: function(r) {
                        
                    }
                });
                $('#paymentBTN').hide();
                Swal.fire(
                    'Successful',
                    'Your payment was successful, we will issue you receipt shortly.',
                    'success'
                )
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
                return
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
                        console.log(r)
                        if(r.message.error){
                            Swal.fire(
                                'Error',
                                r.message.error,
                                'warning'
                            )
                            me.payment_data = {}
                            me.showDiv = false;
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
