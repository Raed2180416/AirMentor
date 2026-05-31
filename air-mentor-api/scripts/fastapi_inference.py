import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from train_sota_tabm_tft import AURAModel

app = FastAPI(title="AURA Framework Inference Worker")

# Initialize model
MODEL = AURAModel(seq_len=10, num_features=20)
MODEL.eval()

class InferenceRequest(BaseModel):
    batch: List[List[List[float]]] # [batch_size, seq_len, features]

class InferenceResponse(BaseModel):
    attendanceRisk: List[float]
    ceRisk_quantiles: List[List[float]]
    seeRisk: List[float]
    overallCourseRisk: List[float]
    downstreamCarryoverRisk: List[float]

@app.post("/predict", response_model=InferenceResponse)
def predict(request: InferenceRequest):
    try:
        x = torch.tensor(request.batch, dtype=torch.float32)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    with torch.no_grad():
        out = MODEL(x)
    
    att_risk = torch.sigmoid(out['attendanceRisk']).squeeze(-1).tolist()
    ce_risk = out['ceRisk'].tolist()
    see_risk = torch.sigmoid(out['seeRisk']).squeeze(-1).tolist()
    overall_risk = torch.sigmoid(out['overallCourseRisk']).squeeze(-1).tolist()
    carryover_risk = torch.exp(out['downstreamCarryoverRisk']).squeeze(-1).tolist()

    return InferenceResponse(
        attendanceRisk=att_risk,
        ceRisk_quantiles=ce_risk,
        seeRisk=see_risk,
        overallCourseRisk=overall_risk,
        downstreamCarryoverRisk=carryover_risk
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
