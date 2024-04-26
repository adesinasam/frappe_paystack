import frappe



def after_insert(doc, event):
    """
    This update cost center with default value
    """
    if doc.payment_request_type=="Inward" and not doc.cost_center:
        ref_doc = frappe.db.get_value(
            doc.reference_doctype, 
            doc.reference_name, 
            ["cost_center", "company"],
            as_dict=1
        )
        if not ref_doc.cost_center:
            cost_center = frappe.db.get_value(
                "Company", 
                ref_doc.company, 
                "cost_center"
            )
        else:
            cost_center = ref_doc.cost_center
        frappe.db.set_value(doc.doctype, doc.name, 'cost_center', cost_center)
        doc.reload()