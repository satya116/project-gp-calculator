/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(["N/runtime", "N/record", "./gp_utils_gp_calculation"], function (
  runtime,
  record,
  GpCalculationUtils,
) {
  function initPage(context, attach) {
    var currentRecord = context.currentRecord;
    var isMultiCurrency = runtime.isFeatureInEffect({
      feature: "multicurrency",
    });

    attach.calculateGrossProfit = function () {
      var lineItemCount = currentRecord.getLineCount({ sublistId: "item" }),
        costfieldId,
        pricefieldId;
      if (lineItemCount < 1) {
        alert("Enter Line Item Value(s).");
        return false;
      }

      var grossProfitFieldIsData =
          runtime
            .getCurrentScript()
            .getParameter({ name: "custscript_gp_setup_fields" }) ||
          runtime
            .getCurrentScript()
            .getParameter({ name: "custscript_gp_store_setup_fields" }),
        grossProfitFieldIds = grossProfitFieldIsData
          ? JSON.parse(grossProfitFieldIsData) || {}
          : {};

      var considerOrderDiscount = grossProfitFieldIds.consider_order_discount
        ? grossProfitFieldIds.consider_order_discount
        : "F";

      if (
        !grossProfitFieldIds.soItemCostFieldId ||
        !grossProfitFieldIds.soItemPriceFieldId ||
        !grossProfitFieldIds.quoteItemCostFieldId ||
        !grossProfitFieldIds.quoteItemPriceFieldId
      ) {
        alert("Please make sure that you have completed Setup.");
        return false;
      }

      if (currentRecord.type === record.Type.ESTIMATE) {
        costfieldId = grossProfitFieldIds.quoteItemCostFieldId;
        pricefieldId = grossProfitFieldIds.quoteItemPriceFieldId;
      } else if (currentRecord.type === record.Type.SALES_ORDER) {
        costfieldId = grossProfitFieldIds.soItemCostFieldId;
        pricefieldId = grossProfitFieldIds.soItemPriceFieldId;
      } else {
        alert(currentRecord.type + " record type is not yet supported.");
        return false;
      }

      if (isMultiCurrency) {
        GpCalculationUtils.calculationForMultiCurrency({
          grossProfitFieldIds: grossProfitFieldIds,
          currentRecord: currentRecord,
          costfieldId: costfieldId,
          pricefieldId: pricefieldId,
          lineItemCount: lineItemCount,
          isClient: true,
          considerDiscountRate: considerOrderDiscount,
        });
      } else {
        GpCalculationUtils.calculationForNonMultiCurrency({
          currentRecord: currentRecord,
          costfieldId: costfieldId,
          pricefieldId: pricefieldId,
          lineItemCount: lineItemCount,
          isClient: true,
          considerDiscountRate: considerOrderDiscount,
        });
      }
    };
  }

  return {
    pageInit: function (context) {
      initPage(context, (window.gp = window.gp || {}));
    },
  };
});
