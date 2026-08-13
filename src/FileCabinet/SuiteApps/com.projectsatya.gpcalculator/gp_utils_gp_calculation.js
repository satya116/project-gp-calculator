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
   * @prop  {Object} args.grossProfitFieldIds
   * @prop  {String} args.contextType
   * @prop  {Boolean} args.isClient
   * @prop  {String} args.considerDiscountRate
   */
  function calculationForMultiCurrency(args) {
    isOneWorld =
      isOneWorld || runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
    var currentRecord = args.currentRecord;
    var costfieldId = args.costfieldId;
    var pricefieldId = args.pricefieldId;
    var lineItemCount = args.lineItemCount;
    var grossProfitFieldIds = args.grossProfitFieldIds;
    var contextType = args.contextType;
    var isClient = args.isClient;
    var currencyTextIdMap = {};
    var currencyIdTextMap = {};
    var currencyIdRateMap = {};
    var usaCurrencyText;
    var poCurrency;
    var transactionCurrencyIds = [];
    var aggregateCost = 0;
    var aggregateSalesPrice = 0;
    var aggregateGP = 0;
    var poRate = 0;
    var quantity = 0;
    var amount = 0;
    var aggregateGPAmount = 0;
    var baseCurrency;
    var orderCurrency = currentRecord.getValue({ fieldId: "currency" });
    var considerDiscountRate = args.considerDiscountRate || "F";

    if (typeof console !== "undefined" && console.log) {
      var logDataTypeModifier = function (args) {
        var title = args.title;
        var details = args.details;

        if (typeof title === "object") {
          title = JSON.stringify(args.title);
        }

        if (typeof details === "object") {
          details = JSON.stringify(args.details);
        }
        return title + " :: " + details;
      };

      debugLogger = function (args) {
        console.log(logDataTypeModifier(args));
      };
      auditLogger = function (args) {
        console.log(logDataTypeModifier(args));
      };
      errorLogger = function (args) {
        console.error(logDataTypeModifier(args));
      };
    } else if (!isClient) {
      debugLogger = log.debug;
      errorLogger = log.error;
      auditLogger = log.audit;
    }

    if (isOneWorld) {
      var subsidiary = currentRecord.getValue({ fieldId: "subsidiary" });
      if (subsidiary) {
        var subsidiaryLookupObject = search.lookupFields({
          type: "subsidiary",
          id: subsidiary,
          columns: ["currency"],
        });

        if (
          subsidiaryLookupObject.currency &&
          subsidiaryLookupObject.currency[0] &&
          subsidiaryLookupObject.currency[0].value
        ) {
          baseCurrency = subsidiaryLookupObject.currency[0].value;
        } else {
          if (isClient) {
            alert(
              "Base currency is not available for subsidiary - " +
                subsidiary +
                ".",
            );
            return false;
          } else {
            throw error.create({
              name: "SUITE_GP_CALCULATION_ERROR",
              message:
                "Base currency is not available for subsidiary - " +
                subsidiary +
                ".",
            });
          }
        }
      }
    } else {
      baseCurrency = grossProfitFieldIds.defaultBaseCurrency;
      if (!baseCurrency) {
        if (isClient) {
          alert(
            "Please make sure that you have completed Setup and base currency is selected.",
          );
          return false;
        } else {
          throw error.create({
            name: "SUITE_GP_CALCULATION_ERROR",
            message:
              "Please make sure that you have completed Setup and base currency is selected.",
          });
        }
      }
    }

    debugLogger({ title: "baseCurrency", details: baseCurrency });

    if (currencySearchResults.length === 0) {
      currencySearchResults = search
        .create({
          type: "currency",
          filters: ["isinactive", "is", false],
          columns: ["name"],
        })
        .run()
        .getRange({ start: 0, end: MAX_CURRENCY_SEARCH_LIMIT });
    }

    currencySearchResults.forEach(function (currency) {
      var currencyName = currency.getValue({ name: "name" });
      currencyTextIdMap[currencyName] = currency.id;
      currencyIdTextMap[currency.id] = currencyName;
      if (currency.id === baseCurrency) {
        usaCurrencyText = currencyName;
      }
    });

    debugLogger({ title: "currency Text Id Map", details: currencyTextIdMap });
    debugLogger({ title: "currency Id Text Map", details: currencyIdTextMap });
    debugLogger({
      title: "currencySearchResults length",
      details: currencySearchResults.length,
    });

    for (var line = 0; line < lineItemCount; line++) {
      poCurrency = currentRecord.getSublistValue({
        sublistId: "item",
        fieldId: "pocurrency",
        line: line,
      });

      if (poCurrency === usaCurrencyText) {
        continue;
      }

      if (
        transactionCurrencyIds.indexOf(currencyTextIdMap[poCurrency]) !== -1
      ) {
        continue;
      }

      if (currencyTextIdMap && currencyTextIdMap[poCurrency]) {
        transactionCurrencyIds.push(currencyTextIdMap[poCurrency]);
      }
    }

    if (
      orderCurrency &&
      orderCurrency !== baseCurrency &&
      transactionCurrencyIds.indexOf(orderCurrency) === -1
    ) {
      transactionCurrencyIds.push(orderCurrency);
    }
    debugLogger({ title: "orderCurrency", details: orderCurrency });
    debugLogger({
      title: "transactionCurrencyIds length",
      details: transactionCurrencyIds.length,
    });

    if (
      transactionCurrencyIds.length !== 0 &&
      currencyRateSearchResults.length === 0
    ) {
      var currencyRateSearchFilters = [];
      var tranDate;
      if (contextType === "create" && !isClient) {
        tranDate = currentRecord.getValue({ fieldId: "trandate" });
        tranDate = new Date(tranDate);
        tranDate = format.format({ value: tranDate, type: format.Type.DATE });
        debugLogger({ title: "tranDate create mode", details: tranDate });
      } else {
        tranDate = currentRecord.getText({ fieldId: "trandate" });
        debugLogger({ title: "tranDate client side", details: tranDate });
      }

      currencyRateSearchFilters.push([
        "transactioncurrency",
        "anyof",
        transactionCurrencyIds,
      ]);
      currencyRateSearchFilters.push("AND", [
        "basecurrency",
        "anyof",
        baseCurrency,
      ]);
      currencyRateSearchFilters.push("AND", ["effectivedate", "on", tranDate]);

      debugLogger({
        title: "currencyRateSearchFilters",
        details: currencyRateSearchFilters,
      });

      currencyRateSearchResults = search
        .create({
          type: "currencyrate",
          filters: currencyRateSearchFilters,
          columns: [
            "basecurrency",
            "transactioncurrency",
            "exchangerate",
            "effectivedate",
          ],
        })
        .run()
        .getRange({ start: 0, end: transactionCurrencyIds.length });

      debugLogger({
        title: "currencyRateSearchResults length",
        details: currencyRateSearchResults.length,
      });
    }

    currencyRateSearchResults.forEach(function (currencyRateSearchResult) {
      var currencyId = currencyRateSearchResult.getValue({
        name: "transactioncurrency",
      });
      var exchangeRate = currencyRateSearchResult.getValue({
        name: "exchangerate",
      });
      currencyIdRateMap[currencyId] = exchangeRate || 0;
    });

    for (var line = 0; line < lineItemCount; line++) {
      var costSublistValue = currentRecord.getSublistValue({
        sublistId: "item",
        fieldId: costfieldId,
        line: line,
      });
      var qtySublistValue = currentRecord.getSublistValue({
        sublistId: "item",
        fieldId: "quantity",
        line: line,
      });
      poCurrency = currentRecord.getSublistValue({
        sublistId: "item",
        fieldId: "pocurrency",
        line: line,
      });

      if (
        poCurrency &&
        usaCurrencyText &&
        usaCurrencyText !== poCurrency &&
        costSublistValue
      ) {
        var currencyRate = currencyIdRateMap[currencyTextIdMap[poCurrency]];
        costSublistValue =
          parseFloat(costSublistValue) * parseFloat(currencyRate);
      }

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

      if (
        orderCurrency &&
        orderCurrency !== baseCurrency &&
        priceSublistValue
      ) {
        var currencyRate =
          currencyIdRateMap[orderCurrency] ||
          currentRecord.getValue({ fieldId: "exchangerate" });
        priceSublistValue =
          parseFloat(priceSublistValue) * parseFloat(currencyRate);
      }

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
    calculationForMultiCurrency: calculationForMultiCurrency,
    calculationForNonMultiCurrency: calculationForNonMultiCurrency,
  };
});
