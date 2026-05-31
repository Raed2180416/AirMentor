import torch
import torch.nn as nn
import torch.nn.functional as F

class AsymmetricFocalLoss(nn.Module):
    def __init__(self, gamma_pos=2.0, gamma_neg=4.0, alpha=0.25):
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.alpha = alpha

    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        targets = targets.float()
        p_loss = -self.alpha * ((1 - probs) ** self.gamma_pos) * targets * torch.log(probs + 1e-8)
        n_loss = -(1 - self.alpha) * (probs ** self.gamma_neg) * (1 - targets) * torch.log(1 - probs + 1e-8)
        return (p_loss + n_loss).mean()

class MultiHorizonQuantileLoss(nn.Module):
    def __init__(self, quantiles=[0.1, 0.5, 0.9]):
        super().__init__()
        self.quantiles = quantiles

    def forward(self, preds, targets):
        # preds: [batch, horizons, num_quantiles]
        # targets: [batch, horizons]
        loss = 0
        for i, q in enumerate(self.quantiles):
            errors = targets - preds[..., i]
            loss += torch.max((q - 1) * errors, q * errors).mean()
        return loss

class ConditionalVIBLoss(nn.Module):
    def __init__(self, beta=1e-3):
        super().__init__()
        self.beta = beta

    def forward(self, mu, logvar, preds, targets):
        bce = F.binary_cross_entropy_with_logits(preds, targets.float())
        kld = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp(), dim=-1).mean()
        return bce + self.beta * kld

class SemanticConstraintLoss(nn.Module):
    def __init__(self, lambda_constraint=0.1):
        super().__init__()
        self.lambda_constraint = lambda_constraint

    def forward(self, preds, targets, constraint_violation):
        bce = F.binary_cross_entropy_with_logits(preds, targets.float())
        penalty = F.relu(constraint_violation).mean()
        return bce + self.lambda_constraint * penalty

class DeepSurvCoxLoss(nn.Module):
    def __init__(self):
        super().__init__()

    def forward(self, risk_preds, events, durations):
        idx = torch.argsort(durations, descending=True)
        events = events[idx]
        risk_preds = risk_preds[idx]
        
        log_risk = risk_preds
        risk = torch.exp(log_risk)
        cum_risk = torch.cumsum(risk, dim=0)
        log_pl = log_risk - torch.log(cum_risk + 1e-8)
        
        loss = -torch.sum(log_pl * events) / (torch.sum(events) + 1e-8)
        return loss

class GLU(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.linear1 = nn.Linear(dim, dim)
        self.linear2 = nn.Linear(dim, dim)
    def forward(self, x):
        return self.linear1(x) * torch.sigmoid(self.linear2(x))

class GRN(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim, dropout=0.1):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.elu = nn.ELU()
        self.fc2 = nn.Linear(hidden_dim, output_dim)
        self.dropout = nn.Dropout(dropout)
        self.gate = GLU(output_dim)
        self.norm = nn.LayerNorm(output_dim)
        if input_dim != output_dim:
            self.skip = nn.Linear(input_dim, output_dim)
        else:
            self.skip = nn.Identity()

    def forward(self, x):
        res = self.skip(x)
        x = self.fc1(x)
        x = self.elu(x)
        x = self.fc2(x)
        x = self.dropout(x)
        x = self.gate(x)
        return self.norm(res + x)

class VariableSelectionNetwork(nn.Module):
    def __init__(self, input_dim, num_inputs, hidden_dim, dropout=0.1):
        super().__init__()
        self.num_inputs = num_inputs
        self.single_var_grns = nn.ModuleList([
            GRN(input_dim, hidden_dim, hidden_dim, dropout)
            for _ in range(num_inputs)
        ])
        self.flattened_grn = GRN(num_inputs * input_dim, hidden_dim, num_inputs, dropout)
        self.softmax = nn.Softmax(dim=-1)

    def forward(self, x):
        flat_x = x.view(*x.shape[:-2], -1)
        weights = self.flattened_grn(flat_x)
        weights = self.softmax(weights).unsqueeze(-1)
        
        processed_vars = []
        for i in range(self.num_inputs):
            processed_vars.append(self.single_var_grns[i](x[..., i, :]))
            
        processed_vars = torch.stack(processed_vars, dim=-2)
        out = torch.sum(processed_vars * weights, dim=-2)
        return out, weights

class TemporalFusionTransformer(nn.Module):
    def __init__(self, num_inputs, input_dim, hidden_dim, num_heads=4, dropout=0.1):
        super().__init__()
        self.vsn = VariableSelectionNetwork(input_dim, num_inputs, hidden_dim, dropout)
        self.encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim, nhead=num_heads, dim_feedforward=hidden_dim*4,
            dropout=dropout, batch_first=True
        )
        self.transformer = nn.TransformerEncoder(self.encoder_layer, num_layers=2)
        self.decoder_grn = GRN(hidden_dim, hidden_dim, hidden_dim, dropout)

    def forward(self, x):
        encoded, _ = self.vsn(x)
        transformer_out = self.transformer(encoded)
        out = self.decoder_grn(transformer_out[:, -1, :])
        return out

class TabM(nn.Module):
    def __init__(self, input_dim, hidden_dim, num_ensembles=5):
        super().__init__()
        self.num_ensembles = num_ensembles
        self.fc1 = nn.Linear(input_dim, hidden_dim)
        self.ensemble_weights = nn.Parameter(torch.randn(num_ensembles, hidden_dim, hidden_dim))
        self.ensemble_bias = nn.Parameter(torch.zeros(num_ensembles, hidden_dim))
        self.act = nn.ReLU()
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)

    def forward(self, x):
        x = self.fc1(x)
        x = self.act(x)
        out = torch.einsum('bi,eij->bej', x, self.ensemble_weights) + self.ensemble_bias
        out = self.act(out)
        out = self.fc2(out)
        return out.mean(dim=1)

class AURAModel(nn.Module):
    def __init__(self, seq_len, num_features, hidden_dim=64):
        super().__init__()
        self.tft = TemporalFusionTransformer(num_inputs=num_features, input_dim=1, hidden_dim=hidden_dim)
        self.tabm = TabM(input_dim=hidden_dim, hidden_dim=hidden_dim, num_ensembles=5)
        
        self.vib_mu = nn.Linear(hidden_dim, hidden_dim)
        self.vib_logvar = nn.Linear(hidden_dim, hidden_dim)
        self.see_head = nn.Linear(hidden_dim, 1)
        
        self.attendance_head = nn.Linear(hidden_dim, 1)
        self.ce_head = nn.Linear(hidden_dim, 3)
        self.overall_head = nn.Linear(hidden_dim, 1)
        self.carryover_head = nn.Linear(hidden_dim, 1)

    def forward(self, x):
        x_tft = x.unsqueeze(-1)
        tft_out = self.tft(x_tft)
        features = self.tabm(tft_out)
        
        attendance_risk = self.attendance_head(features)
        ce_risk = self.ce_head(features)
        
        mu = self.vib_mu(features)
        logvar = self.vib_logvar(features)
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        z = mu + eps * std
        see_risk = self.see_head(z)
        
        overall_risk = self.overall_head(features)
        carryover_risk = self.carryover_head(features)
        
        return {
            'attendanceRisk': attendance_risk,
            'ceRisk': ce_risk,
            'seeRisk': see_risk,
            'overallCourseRisk': overall_risk,
            'downstreamCarryoverRisk': carryover_risk,
            'vib_mu': mu,
            'vib_logvar': logvar
        }
