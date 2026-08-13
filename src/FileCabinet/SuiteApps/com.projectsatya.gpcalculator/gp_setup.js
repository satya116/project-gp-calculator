define([
  "N/runtime",
  "N/ui/serverWidget",
  "N/config",
  "./gp_utils_utils",
], function (ui, configModule, runtime, Utils) {
  function getForm() {
    var isMultiCurrency = runtime.isFeatureInEffect({
      feature: "MULTICURRENCY",
    });
    var isOneWorld = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
    var form = ui.createForm({ title: "GrossProfit Setup" }),
      grossProfitFieldIsData = Utils.getScriptLevelParameter(
        "custscript_gp_setup_fields",
      ),
      grossProfitFieldIds = grossProfitFieldIsData
        ? JSON.parse(grossProfitFieldIsData) || {}
        : {},
      field,
      group;

    group = form.addFieldGroup({
      id: "general_config",
      label: "General",
    });
    field = form.addField({
      id: "so_item_cost",
      type: ui.FieldType.TEXT,
      label: "SO Item Cost Column Field Id",
      container: "general_config",
    });
    field.defaultValue = grossProfitFieldIds.soItemCostFieldId || "";
    field.setHelpText({
      help: "Specify SO line item cost field for getting gross profit.",
      showInlineForAssistant: true,
    });
    field.isMandatory = true;

    field = form.addField({
      id: "so_item_price",
      type: ui.FieldType.TEXT,
      label: "SO Item Price Column Field Id",
      container: "general_config",
    });
    field.defaultValue = grossProfitFieldIds.soItemPriceFieldId || "";
    field.setHelpText({
      help: "Specify SO line item price field for getting gross profit.",
      showInlineForAssistant: true,
    });
    field.isMandatory = true;

    field = form.addField({
      id: "quote_item_cost",
      type: ui.FieldType.TEXT,
      label: "Estimate Item Cost Column Field Id",
      container: "general_config",
    });
    field.defaultValue = grossProfitFieldIds.quoteItemCostFieldId || "";
    field.setHelpText({
      help: "Specify estimate line item cost field for getting gross profit.",
      showInlineForAssistant: true,
    });
    field.isMandatory = true;

    field = form.addField({
      id: "quote_item_price",
      type: ui.FieldType.TEXT,
      label: "Estimate Item Price Column Field Id",
      container: "general_config",
    });
    field.defaultValue = grossProfitFieldIds.quoteItemPriceFieldId || "";
    field.setHelpText({
      help: "Specify estimate line item price field for getting gross profit.",
      showInlineForAssistant: true,
    });
    field.isMandatory = true;

    field = form.addField({
      id: "so_saved_search",
      type: ui.FieldType.TEXT,
      label: "SO Saved Search Id",
      container: "general_config",
    });
    field.defaultValue =
      grossProfitFieldIds.soSavedSearchId || "customsearch_gp_so_search";
    field.setHelpText({
      help:
        "Specify the saved search to be used for pulling SOs which needs to be processed for gross profit calculation. " +
        "The search should not pull too older SOs for performance considerations. Leave the default search selected if you are not sure.",
      showInlineForAssistant: true,
    });
    field.isMandatory = true;

    field = form.addField({
      id: "consider_order_discount",
      type: ui.FieldType.CHECKBOX,
      label: "Consider Order Discount",
      container: "general_config",
    });
    field.defaultValue = grossProfitFieldIds.consider_order_discount || "T";
    field.setHelpText({
      help: "Check this field to consider discount rate while GP calculation.",
      showInlineForAssistant: true,
    });

    if (isMultiCurrency && !isOneWorld) {
      field = form.addField({
        id: "default_base_currency",
        type: ui.FieldType.SELECT,
        label: "Base Currency",
        source: "currency",
        container: "general_config",
      });

      field.defaultValue = grossProfitFieldIds.defaultBaseCurrency || 1;

      field.setHelpText({
        help: "Select default base currency for GP calculation in Non-One World account.",
        showInlineForAssistant: true,
      });
    }

    form.addSubmitButton({ label: "Submit Setup" });

    return form;
  }

  function saveForm(request) {
    var form = ui.createForm({ title: "GrossProfit Setup" }),
      config = configModule.load({
        type: configModule.Type.COMPANY_PREFERENCES,
      }),
      parameters = request.parameters;

    var soItemCostFieldId = request.parameters.so_item_cost || "",
      soItemPriceFieldId = request.parameters.so_item_price || "",
      quoteItemCostFieldId = request.parameters.quote_item_cost || "",
      quoteItemPriceFieldId = request.parameters.quote_item_price || "",
      soSavedSearchId = request.parameters.so_saved_search || "",
      defaultBaseCurrency = request.parameters.default_base_currency || "",
      considerOrderDiscount = request.parameters.consider_order_discount || "T",
      setupFieldIds = {
        soItemCostFieldId: soItemCostFieldId,
        soItemPriceFieldId: soItemPriceFieldId,
        quoteItemCostFieldId: quoteItemCostFieldId,
        quoteItemPriceFieldId: quoteItemPriceFieldId,
        soSavedSearchId: soSavedSearchId,
        defaultBaseCurrency: defaultBaseCurrency,
        consider_order_discount: considerOrderDiscount,
      };

    config.setValue({
      fieldId: "custscript_gp_setup_fields",
      value: JSON.stringify(setupFieldIds),
    });
    config.save();

    var field = form.addField({
      id: "gross_profit_setup",
      type: ui.FieldType.INLINEHTML,
      label: "Gross Profit Setup Label",
    });
    field.defaultValue =
      "<div " +
      Utils.style.SUCCESS_MESSAGE_STYLE +
      ">" +
      "Configuration saved." +
      "</div>";
    return form;
  }

  return {
    getForm: getForm,
    saveForm: saveForm,
  };
});
