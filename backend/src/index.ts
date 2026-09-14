import { app } from "./app.js";
import { environment } from "./config/environment.js";

app.listen(environment.PORT, () => {
  console.log(`M-Team API listening on port ${environment.PORT}`);
});
