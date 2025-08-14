function misc()
{
        const clockEl = document.getElementById("clock");
        if (clockEl) {
          const getTime = function () {
            clockEl.innerHTML = new Date().toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              timeStyle: "long",
              hourCycle: "h24"
            });
          };
          getTime();
          setInterval(getTime, 1000);
        }
        }
export default misc