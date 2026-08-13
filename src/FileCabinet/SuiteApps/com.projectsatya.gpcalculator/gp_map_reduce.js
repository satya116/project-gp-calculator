/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 */
define([
  "N/runtime",
  "N/error",
  "N/record",
  "./gp_utils_lodash",
  "./gp_utils_utils",
], function (runtime, error, record, lodash, Utils) {
  function getSetupFieldData() {
    var setupFieldsData = runtime
      .getCurrentScript()
      .getParameter({ name: "custscript_gp_setup_fields" });
    var setupFields;
    if (!setupFieldsData) {
      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message: "Gross Profit setup is not yet completed.",
        notifyOff: false,
      });
    }

    try {
      setupFields = JSON.parse(setupFieldsData);
    } catch (ex) {
      log.error({
        title: "SUITE_GROSS_PROFIT_ERROR",
        details: "Setup data is corrupted. Please re-run setup.",
      });

      log.error({
        title: "Gross Profit setup data",
        details: setupFieldsData,
      });

      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message:
          "Invalid format recieved from 'Setup' " +
          "for sales order search Id.",
        notifyOff: false,
      });
    }
    return setupFields;
  }

  function getInputData() {
    var setupFields = getSetupFieldData();
    var soSearchId = setupFields.soSavedSearchId || "customsearch_gp_so_search";
    var soSearchResults =
      Utils.nsSearch.getAllResults({ searchId: soSearchId }) || [];
    return soSearchResults;
  }

  function reduce(context) {
    try {
      var value = JSON.parse(context.values[0]);
      updateSalesOrder({
        recordType: value.recordType,
        recordId: value.id,
      });
    } catch (ex) {
      log.error({
        title: "Error Log",
        details: ex.message,
      });
      log.error({
        title: "Error Stack",
        details: ex.stack,
      });
    }
  }

  /**
   * @param {Object} args
   * @prop {String} args.recordType
   * @prop {String} args.recordId
   */
  function updateSalesOrder(args) {
    var soRecord = record.load({
      type: args.recordType,
      id: args.recordId,
      isDynamic: true,
    });

    var grossProfitFieldIds = getSetupFieldData();
    var considerDiscountRate =
      grossProfitFieldIds.consider_order_discount || false;

    var lineItemCount = soRecord.getLineCount({ sublistId: "item" });
    var costfieldId, pricefieldId;

    if (lineItemCount === 0) {
      log.debug({
        title: "GROSS_PROFIT_LINE_ITEM",
        details: "Line Items are not selected.",
      });
      return;
    }

    if (
      !grossProfitFieldIds.soItemCostFieldId ||
      !grossProfitFieldIds.soItemPriceFieldId
    ) {
      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message: "Please make sure that you have completed Setup.",
        notifyOff: false,
      });
    }

    if (soRecord.type === "salesorder") {
      costfieldId = grossProfitFieldIds.soItemCostFieldId;
      pricefieldId = grossProfitFieldIds.soItemPriceFieldId;
    } else {
      throw error.create({
        name: "SUITE_GROSS_PROFIT_ERROR",
        message: soRecord.type + " record type is not yet supported.",
        notifyOff: false,
      });
    }

    if (lineItemCount >= 1) {
      var aggregateCost = 0;
      var aggregateSalesPrice = 0;
      var aggregateGP = 0;
      var poRate = 0;
      var quantity = 0;
      var amount = 0;
      var aggregateGPAmount = 0;

      for (var i = 0; i < lineItemCount; i++) {
        if (
          soRecord.getSublistValue({
            sublistId: "item",
            fieldId: costfieldId,
            line: i,
          }) &&
          soRecord.getSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            line: i,
          })
        ) {
          poRate = parseFloat(
            soRecord.getSublistValue({
              sublistId: "item",
              fieldId: costfieldId,
              line: i,
            }),
          );
          quantity = parseFloat(
            soRecord.getSublistValue({
              sublistId: "item",
              fieldId: "quantity",
              line: i,
            }),
          );
          aggregateCost = aggregateCost + poRate * quantity;
        }

        if (
          soRecord.getSublistValue({
            sublistId: "item",
            fieldId: pricefieldId,
            line: i,
          })
        ) {
          amount = parseFloat(
            soRecord.getSublistValue({
              sublistId: "item",
              fieldId: pricefieldId,
              line: i,
            }),
          );
          aggregateSalesPrice = aggregateSalesPrice + amount;
        }
      }

      var discountrate;
      if (considerDiscountRate === "T" || considerDiscountRate === true) {
        var discountrate =
          soRecord.getValue({
            fieldId: "discounttotal",
          }) || 0;

        discountrate = parseFloat(discountrate);
        aggregateSalesPrice = aggregateSalesPrice + discountrate;
      }

      aggregateGPAmount = (aggregateSalesPrice - aggregateCost).toFixed(2);
      if (aggregateSalesPrice !== 0) {
        aggregateGP = (
          ((aggregateSalesPrice - aggregateCost) / aggregateSalesPrice) *
          100
        ).toFixed(2);
      }

      if (aggregateGP < 0) {
        aggregateGP = 0;
      }

      soRecord.setValue({
        fieldId: "custbody_aggregate_cost",
        value: aggregateCost,
      });
      soRecord.setValue({
        fieldId: "custbody_aggregate_sales_price",
        value: aggregateSalesPrice,
      });
      soRecord.setValue({
        fieldId: "custbody_aggregate_gp",
        value: aggregateGPAmount,
      });
      soRecord.setValue({
        fieldId: "custbody_aggregate_gp_percent",
        value: aggregateGP,
      });
      var id = soRecord.save();
      log.audit({
        title: "Record Id",
        details: id,
      });
    }
    return;
  }

  return {
    getInputData: getInputData,
    reduce: reduce,
  };
});
