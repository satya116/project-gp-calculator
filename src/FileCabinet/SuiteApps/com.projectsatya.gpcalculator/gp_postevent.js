/**
 * @NApiVersion 2.x
 */
define(["N/search"], function (search) {
  function postevent(context) {
    log.debug({ title: "GP is set", details: "hook for custom logic" });
  }

  return {
    postevent: postevent,
  };
});
