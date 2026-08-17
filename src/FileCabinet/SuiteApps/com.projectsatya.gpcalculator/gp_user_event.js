/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define([
  "N/render",
  "N/record",
  "N/error",
  "N/runtime",
  "./gp_utils_utils",
  "./gp_postevent",
  "./gp_utils_queue_record",
  "./gp_utils_gp_calculation",
], function (
  render,
  record,
  error,
  runtime,
  Utils,
  postevent,
  QueueUtil,
  GpCalculationUtils,
) {
  var GROSS_PROFIT_CALCULATION_BUTTON =
    '<script type="text/javascript">' +
    'var css = ".gp-calculation:hover{background-color: #E5E5E5;} ' +
    ".gp-calculation {font-size:14px; " +
    "padding: 5px 12px; " +
    "margin-top: 10px; " +
    "cursor: pointer; " +
    "font-weight: 600; " +
    "border-color: #b2b2b2 !important; " +
    "border: solid transparent 1px; " +
    "border-radius: 3px; " +
    'background-color: #efefef;}",' +
    'head = document.head || document.getElementsByTagName("head")[0],' +
    'style = document.createElement("style");' +
    'style.type = "text/css";' +
    "if(style.styleSheet){" +
    "style.styleSheet.cssText = css;" +
    "}else {" +
    "style.appendChild(document.createTextNode(css));" +
    "}" +
    "head.appendChild(style);" +
    "function gpCalculationButtonClick(){" +
    "return gp.calculateGrossProfit()" +
    "};" +
    "</script>";

  var ASYNC_MR_SCRIPT_ID = "customscript_gp_async_update";
  var ASYNC_MR_SCRIPT_DEPLOY_IDS = [
    "customdeploy_gp_async_update_so1",
    "customdeploy_gp_async_update_so2",
    "customdeploy_gp_async_update_so3",
  ];
  var JOB_NAME = "grossprofitrecalc";

  function beforeLoad(context) {
    if (
      (context.type === context.UserEventType.CREATE ||
        context.type === context.UserEventType.EDIT) &&
      context.newRecord.type !== "purchaseorder"
    ) {
      context.newRecord.setValue({
        fieldId: "custbody_gp_calculation",
        value:
          "<div>" +
          '<input type="button" class="gp-calculation" value="Calculate Gross Profit"' +
          ' onclick="gpCalculationButtonClick()">' +
          "</div>" +
          GROSS_PROFIT_CALCULATION_BUTTON,
      });
    }
  }

  function afterSubmit(context) {
    if (context.type !== context.UserEventType.EDIT) {
      return;
    }

    var newRecord = context.newRecord;
    if (newRecord.type !== "purchaseorder") {
      return;
    }

    if (!newRecord.getValue({ fieldId: "createdfrom" })) {
      return log.debug({ title: "created from missing" });
    }

    var oldRecord = context.oldRecord;
    var isRateChanged = false;
    var oldLinesCount = oldRecord.getLineCount({ sublistId: "item" });

    for (var i = 0; i < oldLinesCount; i++) {
      if (
        oldRecord.getSublistValue({
          fieldId: "rate",
          sublistId: "item",
          line: i,
        }) !==
        newRecord.getSublistValue({
          fieldId: "rate",
          sublistId: "item",
          line: i,
        })
      ) {
        isRateChanged = true;
        break;
      }
    }

    var salesOrderRecord;
    if (isRateChanged) {
      log.debug({
        title: "updating SO",
        details: newRecord.getValue({ fieldId: "createdfrom" }),
      });
      salesOrderRecord = record.load({
        type: "salesorder",
        id: newRecord.getValue({ fieldId: "createdfrom" }),
        isDynamic: false,
      });
      if (
        Utils.getScriptLevelParameter("custscript_gp_fire_async_update") ===
        true
      ) {
        var queueId = QueueUtil.addToQueue({
          transaction: newRecord.getValue({ fieldId: "createdfrom" }),
          integrationName: JOB_NAME,
        });
        log.debug({ title: "record has been queued", details: queueId });

        Utils.validateAndFireMapReduceScript({
          scriptId: ASYNC_MR_SCRIPT_ID,
          deploymentId: ASYNC_MR_SCRIPT_DEPLOY_IDS,
          skipRoleCheck: true,
        });
      } else {
        updateRecord({
          newRecord: salesOrderRecord,
          contextType: context.type,
        });
        var id = salesOrderRecord.save();
        log.debug({ title: "updated SO", details: id });
      }
    }
  }

  /**
   *
   * @param args
   * @prop args.newRecord
   */
  function updateRecord(args) {
    var isMultiCurrency = runtime.isFeatureInEffect({
      feature: "multicurrency",
    });
    var newRecord = args.newRecord;
    var contextType = args.contextType;
    var lineItemCount = newRecord.getLineCount({ sublistId: "item" });
    var grossProfitFieldIsData = Utils.getScriptLevelParameter(
        "custscript_gp_setup_fields",
      ),
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
      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message: "Please make sure that you have completed Setup.",
      });
    }

    if (newRecord.type === record.Type.ESTIMATE) {
      costfieldId = grossProfitFieldIds.quoteItemCostFieldId;
      pricefieldId = grossProfitFieldIds.quoteItemPriceFieldId;
    } else if (newRecord.type === record.Type.SALES_ORDER) {
      costfieldId = grossProfitFieldIds.soItemCostFieldId;
      pricefieldId = grossProfitFieldIds.soItemPriceFieldId;
    }

    GpCalculationUtils.calculationForNonMultiCurrency({
      currentRecord: newRecord,
      costfieldId: costfieldId,
      pricefieldId: pricefieldId,
      lineItemCount: lineItemCount,
      isClient: false,
      considerDiscountRate: considerOrderDiscount,
    });

    postevent.postevent({ newRecord: newRecord });
    return newRecord;
  }

  function beforeSubmit(context) {
    var newRecord = context.newRecord;

    if (
      (context.type === context.UserEventType.CREATE ||
        context.type === context.UserEventType.EDIT) &&
      newRecord.getValue({ fieldId: "custbody_gp_calc_run_on_save" }) === true
    ) {
      if (newRecord.type === "purchaseorder") {
        return;
      }

      if (newRecord.type !== "salesorder" && newRecord.type !== "estimate") {
        throw error.create({
          name: "SUITE_GROSS_PROFIT_ERROR",
          message: newRecord.type + " record type is not yet supported.",
        });
      }

      var lineItemCount = newRecord.getLineCount({ sublistId: "item" });
      var costfieldId, pricefieldId;

      if (lineItemCount < 1) {
        log.debug({
          title: "GROSS_PROFIT_LINE_ITEM",
          details: "Line Items are not selected.",
        });
        return;
      }

      updateRecord({
        newRecord: newRecord,
        contextType: context.type,
      });
    }
  }

  function attachUserEvent(userEvent) {
    return function (context) {
      try {
        userEvent.apply(null, arguments);
      } catch (ex) {
        Utils.logErrorAndStack({
          title: "Event Exception",
          exception: ex,
        });
      }
    };
  }

  return {
    beforeLoad: attachUserEvent(beforeLoad),
    beforeSubmit: attachUserEvent(beforeSubmit),
    afterSubmit: attachUserEvent(afterSubmit),
  };
});
