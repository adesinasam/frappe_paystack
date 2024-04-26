# Copyright (c) 2023, Anthony C. Emmanuel and contributors
# For license information, please see license.txt

import frappe, requests, json
from frappe.model.document import Document

class PaystackLog(Document):
	
	def after_insert(self):
		self.verify_payment()
  
	def verify_payment(self):
		secret_key = frappe.get_doc(
			"Paystack Gateway Setting",
			{'enabled':1,}
		).get_secret_key()
		headers = {"Authorization": f"Bearer {secret_key}"}
		req = requests.get(
			f"https://api.paystack.co/transaction/verify/{self.reference}",
			headers=headers, timeout=10
		)
		if req.status_code in [200, 201]:
			response = frappe._dict(req.json())
			data = frappe._dict(response.data)
			metadata = frappe._dict(data.metadata)
			frappe.db.set_value(self.doctype, self.name, "amount", data.amount/100)
			frappe.db.set_value(self.doctype, self.name, "payment_request", metadata.payment_request)
			
			if frappe.db.exists("Payment Request", {"name":metadata.payment_request}):
				payment_request = frappe.get_doc("Payment Request", metadata.payment_request, ignore_permissions=1)
				# check if reference document is not cancelled or deleted
				ref_doc = frappe.db.get_value(
					payment_request.reference_doctype, 
					payment_request.reference_name,
					["name", 'docstatus', "status"],
					as_dict=1
				)
				if (ref_doc.docstatus==1 and payment_request.status=="Requested" and 
					data.status=="success" and payment_request.grand_total==data.amount/100):
					payment_request.run_method("on_payment_authorized", 'Completed')
					
	
	def validate(self):
		self.validate_currency()

	def before_submit(self):
		if self.status!="Paid":
			frappe.throw("Unpaid request cannot be submitted.")

	def validate_currency(self):
		# check for supported currency
		currencies = supported_currencies = ['NGN', 'GHS', 'ZAR', 'USD']
		if not currencies:
			frappe.throw("No supported currency found for the selected gateway.")
		if not self.currency in currencies:
			frappe.throw(f"""
				{self.gateway} gateway only support currencies {currencies}
			""")

	def send_payment_request(self):
		subject = self.subject.format(doc=self)
		message = self.message.format(doc=self)
		frappe.sendmail(
			recipients=[self.email],
			subject=self.subject,
			message=message,
		)

	@frappe.whitelist()
	def get_amount(self, doc):
		doc = frappe._dict(doc)
		try:
			amount = frappe.db.get_value(doc.reference_doctype, doc.reference_name, 'grand_total')
			if amount:return amount
			amount = frappe.db.get_value(doc.reference_doctype, doc.reference_name, 'total')
			if amount:return amount
		except:
			amount = 0
		return amount
	
@frappe.whitelist()
def make_payment_gateway_request(source_name, target_doc = None):
	args = frappe._dict(json.loads(frappe.form_dict.args))

	def set_missing_values(source, target):
		target.reference_doctype = source.doctype
		target.reference_name = source.name
		target.amount = source.grand_total
		target.cost_center = source.cost_center
		target.currency = source.currency
	
	doc = get_mapped_doc(args.doctype, source_name, {
        args.doctype: {
			"doctype": "Payment Gateway Request",
			# "field_map": {
			# 	"reference_doctype": "doctype",
			# 	"reference_name": "name",
			# 	"amount":"grand_total",
			# 	"customer":"customer",
			# }
		}
    },
	target_doc,
	set_missing_values,
	ignore_permissions=True,
	)
	print(doc, target_doc)
	return doc
