define(["N/error", "N/search", "N/runtime", "N/format"], function (
  error,
  search,
  runtime,
  format,
) {
  var MAX_CURRENCY_SEARCH_LIMIT = 100;
  var currencyRateSearchResults = [];
  var currencySearchResults = [];
  var isOneWorld;

  var debugLogger, errorLogger, auditLogger;

  debugLogger = function () {};
  auditLogger = function () {};
  errorLogger = function () {};

  /**
   * @param {Object} args
   * @prop  {Object} args.currentRecord
   * @prop  {String} args.costfieldId
   * @prop  {String} args.pricefieldId
   * @prop  {Integer} args.lineItemCount
   * @prop  {String} args.considerDiscountRate
   */
  function calculationForNonMultiCurrency(args) {
    var currentRecord = args.currentRecord;
    var costfieldId = args.costfieldId;
    var pricefieldId = args.pricefieldId;
    var lineItemCount = args.lineItemCount;
    var considerDiscountRate = args.considerDiscountRate || "F";

    var aggregateCost = 0,
      aggregateSalesPrice = 0,
      aggregateGP = 0,
      poRate = 0,
      quantity = 0,
      amount = 0,
      aggregateGPAmount = 0;

    for (var line = 0; line < lineItemCount; line++) {
      var costSublistValue = currentRecord.getSublistValue({
          sublistId: "item",
          fieldId: costfieldId,
          line: line,
        }),
        qtySublistValue = currentRecord.getSublistValue({
          sublistId: "item",
          fieldId: "quantity",
          line: line,
        });

      if (costSublistValue && qtySublistValue) {
        poRate = parseFloat(costSublistValue);
        quantity = parseFloat(qtySublistValue);
        aggregateCost = aggregateCost + poRate * quantity;
      }

      var priceSublistValue = currentRecord.getSublistValue({
        sublistId: "item",
        fieldId: pricefieldId,
        line: line,
      });
      if (priceSublistValue) {
        amount = parseFloat(priceSublistValue);
        aggregateSalesPrice = aggregateSalesPrice + amount;
      }
    }

    var discountrate;
    if (considerDiscountRate === "T" || considerDiscountRate === true) {
      var discountrate =
        currentRecord.getValue({
          fieldId: "discounttotal",
        }) || 0;

      discountrate = parseFloat(discountrate);
      aggregateSalesPrice = aggregateSalesPrice + discountrate;
    }

    if (aggregateSalesPrice <= 0) {
      aggregateGP = 0;
      aggregateGPAmount = 0;
    } else {
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
    }

    currentRecord.setValue({
      fieldId: "custbody_aggregate_cost",
      value: aggregateCost.toFixed(2),
    });
    currentRecord.setValue({
      fieldId: "custbody_aggregate_sales_price",
      value: aggregateSalesPrice.toFixed(2),
    });
    currentRecord.setValue({
      fieldId: "custbody_aggregate_gp",
      value: aggregateGPAmount,
    });
    currentRecord.setValue({
      fieldId: "custbody_aggregate_gp_percent",
      value: aggregateGP,
    });
  }

  return {
    calculationForNonMultiCurrency: calculationForNonMultiCurrency,
  };
});
